SIMPLIFIED=0.25

all: data/bundeslaender.topojson

data/bundeslaender_full.topojson:
	node_modules/.bin/geo2topo data/bundeslaender.geojson > data/bundeslaender_full.topojson

data/bundeslaender.topojson: data/bundeslaender_full.topojson
	node_modules/.bin/toposimplify -f -F -P $(SIMPLIFIED) -o data/bundeslaender.topojson data/bundeslaender_full.topojson
