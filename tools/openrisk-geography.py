"""Generate the lightweight map and city gazetteer from Natural Earth GeoJSON."""
import json
import sys
from pathlib import Path

source = Path(sys.argv[1])
engine = Path(__file__).resolve().parents[1] / 'api/_openrisk/engine'
asset = engine.parent


def read(name):
    return json.loads((source / (name + '.json')).read_bytes())['features']


def rings(g):
    return [r for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]) for r in poly]


def clip(points, axis, edge, sign):
    if len(points) < 3:
        return []
    out = []
    a = points[-1]
    for b in points:
        a_in, b_in = (a[axis]-edge)*sign >= 0, (b[axis]-edge)*sign >= 0
        if a_in != b_in:
            t = (edge-a[axis]) / (b[axis]-a[axis])
            out.append([a[i]+(b[i]-a[i])*t for i in range(2)])
        if b_in:
            out.append(b)
        a = b
    return out


def path(polygons, bounds):
    west, south, east, north = bounds
    result = []
    for points in polygons:
        for axis, edge, sign in [(0,west,1),(0,east,-1),(1,south,1),(1,north,-1)]:
            points = clip(points,axis,edge,sign)
        if len(points) < 3:
            continue
        mapped = [f'{300*(x-west)/(east-west):.1f},{115*(north-y)/(north-south):.1f}' for x,y in points]
        result.append('M'+' '.join(dict.fromkeys(mapped))+'Z')
    return ' '.join(result)


countries = {f['properties']['ADMIN']: f['geometry'] for f in read('countries')}
regions = {
    'belgium': ('Belgium', [2.50,49.47,6.50,51.59]),
    'england': ('United Kingdom', [-6.0,49.7,2.1,56.0]),
    'netherlands': ('Netherlands', [3.15,50.65,7.35,53.7]),
    'germany': ('Germany', [5.7,47.1,15.4,55.3]),
    'france': ('France', [-5.5,41.1,9.85,51.5]),
}
bounds = {key: frame for key, (_, frame) in regions.items()}
paths = {key: path(rings(countries[name]), frame) for key, (name, frame) in regions.items()}
bounds.update({
    'bay': [-122.67,37.25,-121.87,37.94],
    'new-york-city': [-74.28,40.47,-73.67,40.96],
    'shanghai': [120.85,30.68,122.08,31.55],
    'greater-bay-area': [112.2,21.85,114.75,23.48],
    'morocco': [-13.45,27.5,-0.8,36.05],
})
land = [r for f in read('land') for r in rings(f['geometry'])]
for key in ['bay', 'new-york-city', 'shanghai', 'greater-bay-area']:
    paths[key] = path(land, bounds[key])
paths['morocco'] = path(rings(countries['Morocco']), bounds['morocco'])
(asset/'insets.js').write_text('// Natural Earth 1:10m public domain geometry.\nexport default ' + json.dumps({'bounds':bounds,'paths':paths},separators=(',',':'))+';\n')

places = []
for feature in read('places'):
    row = feature['properties']
    lon,lat = feature['geometry']['coordinates']
    places.append([row['name'],row['adm0name'],round(lat,4),round(lon,4),row['pop_max'] or 0])
places.sort(key=lambda row: -row[-1])
(engine/'places.js').write_text('// Natural Earth 1:10m populated places, public domain.\nexport default ' + json.dumps([row[:-1] for row in places],ensure_ascii=False,separators=(',',':'))+';\n')
