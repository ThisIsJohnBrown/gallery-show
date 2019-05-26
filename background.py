import sys
import base64
import json
import numpy as np
import cv2
import time
import websocket
from shapely.geometry import Polygon
from argparse import ArgumentParser

try:
    import thread
except ImportError:
    import _thread as thread
import threading


parser = ArgumentParser()
parser.add_argument("-n", "--no-image", dest="no_image")
parser.add_argument("-t", "--show-threshold", dest="show_threshold")
parser.add_argument("-o", "--show-outlines", dest="show_outlines")
parser.add_argument("-s", "--show-shapes", dest="show_shapes")
parser.add_argument("--hostname", dest="hostname")
args = parser.parse_args()

width = 640
height = 480

cap = cv2.VideoCapture(1)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0)
cap.set(cv2.CAP_PROP_EXPOSURE, -3.0)
fgbg = cv2.createBackgroundSubtractorMOG2(1000)

detector = cv2.SimpleBlobDetector_create()

shapes = json.loads(open('shape_config.json', 'r').read())

socket = None
socket_open = False


def update_shapes(data):
    data_num = 0
    for d in data:
        shapes[data_num] = d
        data_num += 1


def on_message(ws, message):
    data = json.loads(message)
    if data['event'] == 'shapeData' or data['event'] == 'updateAreas':
        update_shapes(data['data'])


def on_error(ws, error):
    print(error)


def on_close(ws):
    print("### closed ###")
    time.sleep(5)
    socket_open = False
    init_socket()


def on_open(ws):
    socket_open = True
    print('+++ open +++')


def init_socket():
    print('init_socket')
    global socket
    socket = websocket.WebSocketApp("ws://" + ('localhost' if args.hostname is None else args.hostname) + ":8080",
                                    on_message=on_message,
                                    on_error=on_error,
                                    on_close=on_close,
                                    on_open=on_open)
    wst = threading.Thread(target=socket.run_forever)
    wst.receive_messages = 1
    wst.daemon = True
    wst.start()
    return socket


# while(socket_open is False):
#     socket = init_socket()
#     time.sleep(5)
socket = init_socket()

while(1):
    ret, frame = cap.read()

    fgmask = fgbg.apply(frame, learningRate=0.002)

    im_gauss = cv2.GaussianBlur(fgmask, (5, 5), 0)
    ret, thresh = cv2.threshold(im_gauss, 127, 255, 0)
    contours, hierarchy = cv2.findContours(
        thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    thresh = cv2.cvtColor(thresh, cv2.COLOR_BGR2RGB)

    cam_return = thresh if args.show_threshold else frame

    for sh in shapes:
        sha = np.array(sh["points"], np.int32)
        sha = sha.reshape((-1, 1, 2))
        if args.show_shapes:
            cv2.polylines(cam_return, [sha], True,
                          (int(sh["rgb"][2]), int(sh["rgb"][1]), int(sh["rgb"][0])), 4)

    coordinates = []
    for con in contours:
        area = cv2.contourArea(con)
        if 1000 < area:
            x, y, w, h = cv2.boundingRect(con)
            shape_num = 0
            for sh in shapes:
                if shape_num not in coordinates:
                    p1 = Polygon(sh["points"])
                    p2 = Polygon([(x, y), (x+w, y), (x+w, y+h), (x, y+h)])

                    if p1.intersects(p2):
                        coordinates.append(shape_num)
                        if args.show_outlines:
                            cv2.rectangle(cam_return, (x, y), (x+w, y+h),
                                          (int(sh["rgb"][2]), int(
                                              sh["rgb"][1]), int(sh["rgb"][0])), 2)
                            cv2.circle(cam_return, (int(x + w/2), int(y + h/2)),
                                       10,
                                       (int(sh["rgb"][2]), int(
                                        sh["rgb"][1]), int(sh["rgb"][0])), -1)

                    # sha = np.array(sh["points"], np.int32)
                    # sha = sha.reshape((-1, 1, 2))
                    # if cv2.pointPolygonTest(sha, (int(x + w/2), int(y + h/2)), False) == 1:
                    #     coordinates.append(shape_num)
                    #     cv2.rectangle(cam_return, (x, y), (x+w, y+h),
                    #                   (0, 255, 255), 2)
                    #     cv2.circle(cam_return, (int(x + w/2), int(y + h/2)),
                    #                10, (255, 0, 0), -1)
                shape_num += 1

    encoded, buffer = cv2.imencode('.jpg', cam_return)
    jpg_as_text = base64.b64encode(buffer)
    try:
        socket.send(json.dumps({
            "event": "camUpdate",
            "data": {
                "camData": '' if args.no_image else str(jpg_as_text),
                "movement": coordinates
            }
        }))
    except:
        pass

    time.sleep(1/10)

    # if len(coordinates):
    #     print(coordinates)
    # websocket.send(json.dumps({
    #     "event": "movement",
    #     "data": ','.join(str(e) for e in coordinates)
    # }))

    # vertical_concat=np.concatenate((frame, thresh), axis=0)

    # cv2.imshow('frame', vertical_concat)
    # cv2.imshow('frame1',thresh)

    k = cv2.waitKey(30) & 0xff
    if k == 27:
        break


cap.release()
cv2.destroyAllWindows()
