import os
path = r'C:\Users\david\AppData\Local\Temp\opencode\_script_19.js'
with open(path, 'rb') as f:
    raw = f.read()
cr = raw.count(b'\r\n')
dbl = raw.count(b'\r\r\n')
print('Total CRLF sequences:', cr)
print('Doubled CR CRLF:', dbl)
lines = raw.split(b'\n')
for i in [574, 575, 576, 577, 578, 579]:
    if i < len(lines):
        l = lines[i]
        print("Line {}: len={}, ends_with_cr={}".format(i+1, len(l), l.endswith(b'\r')))
