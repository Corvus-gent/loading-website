import math
from pathlib import Path

P="#5B3E8C"; G="#FFD76A"; BG="#0D0A12"
CROW="M60 122 C58 96 68 70 94 62 C105 59 115 62 121 68 Q143 74 162 90 Q139 92 118 95 L114 103 C110 110 106 116 102 122 Z"
def lantern(x,y,s=1):
    w,h=7*s,10*s
    return (f'<g fill="{G}"><rect x="{x-w/2-1.5*s:.1f}" y="{y-h/2-1.5*s:.1f}" width="{w+3*s:.1f}" height="{2*s:.1f}" rx="{s:.1f}"/>'
     f'<rect x="{x-w/2:.1f}" y="{y-h/2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{1.2*s:.1f}"/><rect x="{x-w/2-1.5*s:.1f}" y="{y+h/2-.5*s:.1f}" width="{w+3*s:.1f}" height="{2*s:.1f}" rx="{s:.1f}"/></g>'
     f'<path d="M{x:.1f} {y-3*s:.1f} C{x-2*s:.1f} {y:.1f} {x-2*s:.1f} {y+2.5*s:.1f} {x:.1f} {y+3.5*s:.1f} C{x+2*s:.1f} {y+2.5*s:.1f} {x+2*s:.1f} {y:.1f} {x:.1f} {y-3*s:.1f} Z" fill="{BG}"/>')
def cone(d,o): return f'<g clip-path="url(#c)"><path d="{d}" fill="{G}" opacity="{o:.3f}"/></g>'
def meridians(phase):
    out=[]
    for k in range(6):
        lon=math.radians(phase+k*60)
        if math.cos(lon)<=0.02: continue
        pts=[(100+math.sqrt(max(0,76**2-(y-100)**2))*math.sin(lon),y) for y in range(122,179,2)]
        out.append('<path d="M'+' L'.join(f'{x:.1f} {y}' for x,y in pts)+'"/>')
    return f'<g clip-path="url(#c)" fill="none" stroke="{P}" stroke-width="3" stroke-linecap="round">'+''.join(out)+'<line x1="0" y1="122" x2="200" y2="122" stroke-width="4"/></g>'
EYE_DARK=f'<circle cx="104" cy="76" r="4" fill="{BG}"/>'
EYE_GOLD=f'<circle cx="104" cy="76" r="4.5" fill="{G}"/>'
BEAK=f'<line x1="150" y1="89" x2="150" y2="98" stroke="{G}" stroke-width="2"/>'+lantern(150,106,1.1)
TOP=f'<line x1="100" y1="22" x2="100" y2="36" stroke="{G}" stroke-width="2"/>'+lantern(100,44,1)
# Light setups per weekday: (behind-crow layers, front layers).
def light(day,g):
    return {
     1:(cone("M150 108 L112 178 L188 178 Z",g), EYE_DARK+BEAK),
     2:(cone("M100 50 L58 122 L142 122 Z",g)+TOP, EYE_GOLD),
     3:(cone("M100 24 L60 122 L140 122 Z",g), EYE_GOLD),
     4:(cone("M100 134 L40 40 L160 40 Z",g*.8), EYE_GOLD+lantern(100,134,1.1)),
     5:("", EYE_DARK+BEAK),
     6:("", f'<circle cx="104" cy="76" r="8" fill="{BG}"/>'+lantern(104,77,.7)),
     7:("", EYE_GOLD),
    }[day]
def logo(day, phase=None, glow=0.15, bg=True, size=400):
    phase=(day-1)*360/7 if phase is None else phase
    back,front=light(day,glow)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="{size}" height="{size}">'
      +(f'<rect width="200" height="200" fill="{BG}"/>' if bg else '')
      +'<clipPath id="c"><circle cx="100" cy="100" r="76"/></clipPath>'+back
      +f'<circle cx="100" cy="100" r="78" fill="none" stroke="{P}" stroke-width="5"/>'
      +f'<path d="{CROW}" fill="{P}"/>'+meridians(phase)+front+'</svg>')


if __name__ == '__main__':
    output = Path(__file__).resolve().parents[2] / 'public' / 'logo'
    output.mkdir(exist_ok=True)
    for day in range(1, 8):
        (output / f'day-{day}.svg').write_text(logo(day), encoding='utf-8')
        (output / f'day-{day}-transparent.svg').write_text(logo(day, bg=False), encoding='utf-8')
