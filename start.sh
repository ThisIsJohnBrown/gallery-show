#!/bin/bash
cd /home/pi/gallery-show;
source /home/pi/.virtualenvs/cv/bin/activate;
/usr/bin/v4l2-ctl --set-ctrl=exposure_auto_priority=0
/home/pi/.virtualenvs/cv/bin/python /home/pi/gallery-show/background.py --pi=True;

