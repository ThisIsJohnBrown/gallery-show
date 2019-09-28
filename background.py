import threading
from argparse import ArgumentParser
from shapely.geometry import Polygon
import websocket
import time
import cv2
import numpy as np
import json
import base64
import sys


try:
    import thread
except ImportError:
    import _thread as thread

parser = ArgumentParser()
parser.add_argument("--pi", dest="pi")
parser.add_argument("--no-image", dest="no_image")
parser.add_argument("--show-threshold", dest="show_threshold")
parser.add_argument("--show-outlines", dest="show_outlines")
parser.add_argument("--show-shapes", dest="show_shapes")
parser.add_argument("--debounce-sensitivity",
                    dest="debounce_sensitivity", type=int, default=4)
parser.add_argument("--hostname", dest="hostname")
args = parser.parse_args()

if args.pi:
    import pygame
    import mutagen.mp3
    mp3 = mutagen.mp3.MP3('/home/pi/gallery-show/public/audio/background.mp3')
    pygame.mixer.init(frequency=mp3.info.sample_rate)
    pygame.init()
    pygame.mixer.init()
    pygame.mixer.music.load(
        '/home/pi/gallery-show/public/audio/background.mp3')
    pygame.mixer.music.play(1)
    # pygame.mixer.music.set_volume(0)

recalibrationNeeded = False

width = 320
height = 240

debounce = [0, 0, 0, 0]
debounce_triggered = [False, False, False, False]
soundPlaying = False

cap = cv2.VideoCapture(1)
ret, frame = cap.read()
cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
# cap.set(cv2.CAP_PROP_EXPOSURE, -7.0)
fgbg = cv2.createBackgroundSubtractorMOG2()


def list_supported_capture_properties(cap: cv2.VideoCapture):
    """ List the properties supported by the capture device.
    """
    supported = list()
    for attr in dir(cv2):
        if attr.startswith('CAP_PROP'):
            if cap.get(getattr(cv2, attr)) != False:
                supported.append(attr)
    return supported


detector = cv2.SimpleBlobDetector_create()

shapes = json.loads(open('shape_config.json', 'r').read())
config = ''
try:
    config_file = open('config.json', 'r')
    config = json.loads(config_file.read())
    config_file.close()
except:
    config_example = open('config.json.example', 'r')
    info = config_example.read()
    config_example.close()

    config_file = open('config.json', 'w+')
    config_file.write(info)
    config_file.close()
    config = json.loads(info)

socket = None


def update_shapes(data):
    data_num = 0
    for d in data:
        shapes[data_num] = d
        data_num += 1


def update_config(data):
    print(data)
    for d in data['config']:
        print(d)
        config[d] = data['config'][d]


def on_message(ws, message):
    data = json.loads(message)
    print(data['event'])
    if data['event'] == 'shapeData' or data['event'] == 'updateAreas':
        update_shapes(data['data'])
    if data['event'] == 'updateConfig':
        update_config(data['data'])
        print(config)
    if data['event'] == 'updateFlags':
        for flag in data['data']:
            if flag == 'recalibrate':
                global recalibrationNeeded
                recalibrationNeeded = True
            else:
                args._get_args
                args.__dict__[flag] = not args.__dict__[flag]


def on_error(ws, error):
    print(error)


def on_close(ws):
    print("### closed ###")
    time.sleep(5)
    init_socket()


def on_open(ws):
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


socket = init_socket()

lastTime = time.time()
testTime = 1

while(1):
    ret, frame = cap.read()

    if recalibrationNeeded:
        print('recalibrating!')
        fgmask = fgbg.apply(frame, learningRate=1)
        recalibrationNeeded = False
    else:
        fgmask = fgbg.apply(
            frame, learningRate=(.007 / config['learningSpeed']))

    im_gauss = cv2.GaussianBlur(fgmask, (5, 5), 0)
    ret, thresh = cv2.threshold(im_gauss, 200, 255, 0)
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
        if 100 < area:
            x, y, w, h = cv2.boundingRect(con)
            shape_num = 0
            for sh in shapes:
                if shape_num not in coordinates:
                    p1 = Polygon(sh["points"])
                    p2 = Polygon([(x, y), (x+w, y), (x+w, y+h), (x, y+h)])

                    if p1.intersects(p2):
                        if (config['minSize'] * 100) < area and area < (config['maxSize'] * 100):
                            color = (0, 255, 0)
                            if debounce[shape_num] < config['fadeInDelay'] * 16:
                                debounce[shape_num] = debounce[shape_num] + 2
                            coordinates.append(shape_num)
                        else:
                            color = (0, 0, 255)
                        if args.show_outlines:
                            cv2.rectangle(cam_return, (x, y), (x+w, y+h),
                                          color, 1)
                            # cv2.circle(cam_return, (int(x + w/2), int(y + h/2)),
                            #            4,
                            #            (int(sh["rgb"][2]), int(
                            #             sh["rgb"][1]), int(sh["rgb"][0])), -1)
                            cv2.putText(cam_return, str(int(area / 100)), (
                                int(x + w/2), int(y + h/2)), cv2.FONT_HERSHEY_SIMPLEX, .5, color, 2)

                    # sha = np.array(sh["points"], np.int32)
                    # sha = sha.reshape((-1, 1, 2))
                    # if cv2.pointPolygonTest(sha, (int(x + w/2), int(y + h/2)), False) == 1:
                    #     coordinates.append(shape_num)
                    #     cv2.rectangle(cam_return, (x, y), (x+w, y+h),
                    #                   (0, 255, 255), 2)
                    #     cv2.circle(cam_return, (int(x + w/2), int(y + h/2)),
                    #                10, (255, 0, 0), -1)
                shape_num += 1

    new_coordinates = []

    # print(debounce)
    # print(debounce_triggered)

    for i in range(len(debounce)):
        if debounce[i] > 0:
            debounce[i] = debounce[i] - 1

        if debounce[i] >= config['fadeInDelay'] * 16 and debounce_triggered[i] is False:
            new_coordinates.append(i)
            debounce_triggered[i] = True
        elif debounce[i] > 0 and debounce_triggered[i] is True:
            new_coordinates.append(i)
        elif debounce[i] == 0 and debounce_triggered[i] is True:
            debounce_triggered[i] = False
    # for i in range(len(debounce)):

    encoded, buffer = cv2.imencode('.jpg', cam_return)
    jpg_as_text = base64.b64encode(buffer)
    if len(coordinates) > 0 and soundPlaying is False:
        soundPlaying = True
    elif len(coordinates) is 0 and soundPlaying is True:
        soundPlaying = False
    try:
        socket.send(json.dumps({
            "event": "camUpdate",
            "data": {
                "camData": '' if args.no_image else str(jpg_as_text),
                "movement": new_coordinates
            }
        }))
    except:
        pass

    if args.pi:
        # currVolume = pygame.mixer.music.get_volume()
        if soundPlaying is True and pygame.mixer.get_busy() is False:
            pygame.mixer.music.play(1)

    k = cv2.waitKey(30) & 0xff
    if k == 27:
        break
    now = time.time()
    lastTime = now


cap.release()
cv2.destroyAllWindows()
