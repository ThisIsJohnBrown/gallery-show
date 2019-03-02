import base64
import json
import numpy as np
import cv2
import time
import websocket
try:
    import thread
except ImportError:
    import _thread as thread
from shapely.geometry import Polygon

width = 640
height = 480

cap = cv2.VideoCapture(0)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0)
cap.set(cv2.CAP_PROP_EXPOSURE, -3.0)
fgbg = cv2.createBackgroundSubtractorMOG2(1000)

detector = cv2.SimpleBlobDetector_create()

shapes = json.loads(open('shape_config.json', 'r').read())
print(shapes)


def update_shapes(data):
    data_num = 0
    for d in data:
        shapes[data_num] = d
        data_num += 1
    file = open('shape_config.json', 'w')
    file.write(json.dumps(shapes))
    file.close()


def on_message(ws, message):
    print("message")
    data = json.loads(message)
    if data['event'] == 'updateAreas':
        update_shapes(data['data'])


def on_error(ws, error):
    print(error)


def on_close(ws):
    print("### closed ###")


def on_open(ws):
    websocket.send(json.dumps({
        "event": "shapeData",
        "data": shapes
    }))


websocket = websocket.WebSocketApp("ws://localhost:8080",
                                   on_message=on_message,
                                   on_error=on_error,
                                   on_close=on_close,
                                   on_open=on_open)
thread.start_new_thread(websocket.run_forever, ())

while(1):
    ret, frame = cap.read()

    fgmask = fgbg.apply(frame, learningRate=0.002)
    blank_image = np.zeros((720, 1280, 4), np.uint8)
    bg_color = blank_image[0][0]
    mask = np.all(blank_image == bg_color, axis=2)
    blank_image[mask] = [0, 0, 0, 0]
    # plt.imshow(blank_image)

    im_gauss = cv2.GaussianBlur(fgmask, (5, 5), 0)
    ret, thresh = cv2.threshold(im_gauss, 127, 255, 0)
    contours, hierarchy = cv2.findContours(
        thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    thresh = cv2.cvtColor(thresh, cv2.COLOR_BGR2RGB)

    for sh in shapes:
        sha = np.array(sh["points"], np.int32)
        sha = sha.reshape((-1, 1, 2))
        cv2.polylines(frame, [sha], True,
                      (int(sh["rgb"][2]), int(sh["rgb"][1]), int(sh["rgb"][0])))

    coordinates = []
    # print('------------------')
    for con in contours:
        area = cv2.contourArea(con)
        if 1000 < area < 10000:
            x, y, w, h = cv2.boundingRect(con)
            shape_num = 0
            for sh in shapes:
                if shape_num not in coordinates:
                    p1 = Polygon(sh["points"])
                    p2 = Polygon([(x, y), (x+w, y), (x+w, y+h), (x, y+h)])

                    if p1.intersects(p2):
                        coordinates.append(shape_num)
                        cv2.rectangle(frame, (x, y), (x+w, y+h),
                                      (int(sh["rgb"][2]), int(
                                          sh["rgb"][1]), int(sh["rgb"][0])), 2)
                        cv2.circle(frame, (int(x + w/2), int(y + h/2)),
                                   10,
                                   (int(sh["rgb"][2]), int(
                                       sh["rgb"][1]), int(sh["rgb"][0])), -1)

                    # sha = np.array(sh["points"], np.int32)
                    # sha = sha.reshape((-1, 1, 2))
                    # if cv2.pointPolygonTest(sha, (int(x + w/2), int(y + h/2)), False) == 1:
                    #     coordinates.append(shape_num)
                    #     cv2.rectangle(frame, (x, y), (x+w, y+h),
                    #                   (0, 255, 255), 2)
                    #     cv2.circle(frame, (int(x + w/2), int(y + h/2)),
                    #                10, (255, 0, 0), -1)
                shape_num += 1

    encoded, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer)
    websocket.send(json.dumps({
        "event": "camData",
        "data": str(jpg_as_text)
    }))

    # if len(coordinates) and websocket:
    #     websocket.send(','.join(str(e) for e in coordinates))

    vertical_concat = np.concatenate((frame, thresh), axis=0)

    cv2.imshow('frame', vertical_concat)
    # cv2.imshow('frame1',thresh)
    time.sleep(.5)

    k = cv2.waitKey(30) & 0xff
    if k == 27:
        break


cap.release()
cv2.destroyAllWindows()
