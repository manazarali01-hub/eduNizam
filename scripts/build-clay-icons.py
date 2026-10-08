#!/usr/bin/env python3
"""Build responsive CC0 v1 3Dicons (Vijay Verma) plus original soft clay house.
https://3dicons.co/about - icons in the V1 collection are CC0.
All final browser assets are self-hosted optimized WebP, no stock watermark.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.request import Request,urlopen
import time
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/"assets"/"icons"
OUT.mkdir(parents=True,exist_ok=True)
ICONS={
  "home": "house",
  "school": "house",
  "up": "forward",
  "users": "boy",
  "user": "girl",
  "upload": "rocket",
  "attendance": "tick",
  "chart": "chart",
  "teacher": "girl",
  "clock": "clock",
  "wallet": "wallet",
  "cap": "crown",
  "award": "medal",
  "sparkle": "star",
  "door": "lock",
  "id": "card",
  "leave": "calender",
  "results": "trophy",
  "book": "notebook",
  "lesson": "pencil",
  "exam": "file-text",
  "pencil": "pencil",
  "diary": "notebook",
  "schedule": "calender",
  "calendar": "calender",
  "banknote": "money",
  "receipt": "file-text",
  "package": "bag",
  "library": "folder",
  "bus": "travel",
  "pin": "map-pin",
  "party": "gift",
  "chat": "chat-bubble",
  "megaphone": "megaphone",
  "support": "headphone",
  "paper": "file",
  "study": "notebook",
  "landmark": "chess",
  "target": "target",
  "compass": "explorer",
  "route": "location",
  "laptop": "computer",
  "gears": "setting",
  "wrench": "tool",
  "grid": "puzzle",
  "search": "zoom",
  "arrows": "forward",
  "shield": "sheild"
}
BASE="https://3dicons.sgp1.cdn.digitaloceanspaces.com/v1/dynamic/premium"
def download(slug):
  url=f"{BASE}/{slug}-dynamic-premium.png"
  last=None
  for i in range(4):
    try:
      with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 (EduNizam V1 CC0 icon build)"}),timeout=25) as r:
        if "image" not in r.headers.get("Content-Type",""): raise ValueError("Not an image")
        b=r.read(11000000)
      im=Image.open(BytesIO(b)).convert("RGBA")
      im.load()
      if im.width<100 or im.height<100: raise ValueError("Tiny source")
      return im
    except Exception as e:
      last=e;time.sleep(i+1)
  raise RuntimeError(f"Could not fetch CC0 icon {slug}: {last}")

def render_house():
  S=4;N=192;im=Image.new("RGBA",(N*S,N*S),(0,0,0,0))
  shadow=Image.new("RGBA",im.size,(0,0,0,0))
  d=ImageDraw.Draw(shadow)
  d.ellipse((22*S,148*S,171*S,186*S),fill=(21,47,64,76))
  im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9*S)))
  d=ImageDraw.Draw(im)
  def poly(coords,color):d.polygon([(x*S,y*S) for x,y in coords],fill=color)
  def line(coords,color,w=2):d.line([(x*S,y*S) for x,y in coords],fill=color,width=w*S,joint="curve")
  def rect(coords,r,col):d.rounded_rectangle(tuple(v*S for v in coords),radius=r*S,fill=col)
  poly([(23,149),(123,136),(174,153),(73,172)],"#a2c8d4")
  poly([(23,149),(73,172),(73,181),(23,158)],"#416c89")
  poly([(73,172),(174,153),(174,164),(73,181)],"#638ba1")
  poly([(49,76),(102,43),(153,76),(153,146),(101,158),(49,143)],"#f5dfc7")
  poly([(101,77),(153,76),(153,146),(101,158)],"#dec2a0")
  poly([(49,76),(101,77),(101,158),(49,143)],"#fff0dc")
  for x,y in [(60,105),(117,107)]:
    rect((x,y,x+25,y+29),2,"#ad876f")
    rect((x+2,y+2,x+23,y+27),1,"#9bcee0")
    poly([(x+3,y+3),(x+19,y+3),(x+19,y+12),(x+3,y+21)],"#d2eaf0")
    line([(x+12,y+2),(x+12,y+27)],"#ffe9bc",2)
    line([(x+2,y+14),(x+23,y+14)],"#ffe9bc",2)
  rect((90,121,114,158),4,"#809f98")
  rect((93,122,112,158),4,"#a7ddd0")
  poly([(31,83),(92,24),(105,28),(57,98),(53,107),(32,96)],"#df8573")
  poly([(53,97),(105,28),(167,90),(162,99),(106,47),(60,108)],"#ffbd8e")
  poly([(106,47),(167,90),(162,99),(105,56)],"#f2a328")
  line([(36,83),(92,29),(103,30)],"#ffe2cb",3)
  line([(60,96),(106,47),(161,91)],"#ffe9bc",2)
  poly([(67,45),(67,14),(81,11),(81,48)],"#b54e43")
  poly([(81,11),(92,16),(92,55),(81,48)],"#f19e7c")
  poly([(67,14),(81,11),(92,16),(76,19)],"#ffd3b2")
  return im.resize((N,N),Image.Resampling.LANCZOS)

def optimized(im):
  im=im.convert("RGBA")
  bbox=im.getchannel("A").point(lambda a:255 if a>4 else 0).getbbox()
  if bbox: im=im.crop(bbox)
  im.thumbnail((181,181),Image.Resampling.LANCZOS,reducing_gap=3.0)
  final=Image.new("RGBA",(192,192),(0,0,0,0))
  final.alpha_composite(im,((192-im.width)//2,(192-im.height)//2))
  return final

if __name__=="__main__":
  slugs=sorted(set(ICONS.values())-{"house"})
  print(f"Fetching {len(slugs)} CC0 3D source objects",flush=True)
  decoded={}
  with ThreadPoolExecutor(max_workers=7) as ex:
    tasks={ex.submit(download,name):name for name in slugs}
    for future in as_completed(tasks):
      decoded[tasks[future]]=optimized(future.result())
      print(f"OK {tasks[future]}",flush=True)
  decoded["house"]=optimized(render_house())
  for key,slug in ICONS.items():
    image=decoded[slug];file=OUT/f"clay-{key}.webp"
    image.save(file,format="WEBP",quality=85,method=5)
    if file.stat().st_size<500: raise RuntimeError("Small image: "+str(file))
  (OUT/"LICENSE.txt").write_text(
    "Clay icon assets: 3dicons V1 by Vijay Verma, CC0 1.0, https://3dicons.co/ .\n"+
    "Schoolhouse is original custom rendering drawn by EduNizam's build script.\n")
  print(f"PASS: {len(ICONS)} 192px transparent WebP files",flush=True)
