'use strict';

var L = require('leaflet');
var d3 = require('d3');
var topojson = require('topojson');

// Make jQuery global for jQuery.scrollstory
jQuery = $ = require('jquery');
require('scrollstory/dist/jquery.scrollstory.js');
require('@asymmetrik/leaflet-d3');


var tiles = {
  base: {
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  },
  labels: {
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic3RlZmFudyIsImEiOiJlc1k5dUVNIn0.EFWNsi1UwZQ1IcbN2_qJLw',
    attribution: '© <a href="https://www.mapbox.com/feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/feedback/" target="_blank">Improve this map</a></strong>'
  }
};

var bounds = {
  germany: [[ 47.30903424774781, 5.888671875 ], [ 55.10351605801967, 15.161132812500002 ]],
  uppergermany: [[49.908787000867136, 5.6689453125], [54.96500166110205, 15.073242187499998]],
  niedersachsen: [[52.17393169256849, 6.83349609375], [53.330872983017066, 9.5361328125]],
};

var spots = {
  wimex: {
    latlng: [51.7094038,11.9838869],
    zoom: 18,
    uid: 'cb195a38-04ae-43bc-bb73-f4a7385952e3'
  },
  pelapro: {
    latlng: [52.504663,11.1909762],
    zoom: 18
  },
  gutlosten: {
    latlng: [53.7999991,11.4600634],
    zoom: 17
  },
  vanasten: {
    latlng: [51.4803159,10.7849659],
    zoom: 17,
  }
};

L.TopoJSON = L.GeoJSON.extend({
  addData: function(jsonData) {
    if (jsonData.type === 'Topology') {
      for (var key in jsonData.objects) {
        var geojson = topojson.feature(jsonData, jsonData.objects[key]);
        L.GeoJSON.prototype.addData.call(this, geojson);
      }
    }
    else {
      L.GeoJSON.prototype.addData.call(this, jsonData);
    }
  }
});

var dataCache = {};
var dataCacheCallbacks = {};

var getData = function(url, clb) {
  if (dataCache[url]) {
    return clb(dataCache[url]);
  } else {
    if (dataCacheCallbacks[url]) {
      return dataCacheCallbacks[url].push(clb)
    }
    dataCacheCallbacks[url] = [clb];
    var fn = d3.json;
    if (url.indexOf('.csv') !== -1) {
      fn = d3.csv;
    }
    fn(url, function(err, data) {
      dataCache[url] = data;
      dataCacheCallbacks[url].forEach(function(c) {
        c(data);
      });
      dataCacheCallbacks[url] = undefined;
    });
  }
};


var radiusScale = d3.scaleSqrt()
             .range([2, 10]);


var getStateLayer = function(map, options) {
  options = options || {};
  var thisPane = map.createPane('statePane');
  thisPane.style.zIndex = 410;

  var layer = new L.TopoJSON(undefined, {
    pane: thisPane,
    style: function(feat){
      return {
        fill: false,
        color: '#999',
        weight: options.weight || 3
      };
    }
  });
  getData(options.path + 'data/bundeslaender.topojson', function(data) {
    layer.addData(data);
  });
  return layer;
};

var getNitrateLayer = function(map, options) {
  var thisPane = map.createPane('nitratePane');
  thisPane.style.zIndex = 400;

  var hexLayer = L.hexbinLayer({
    pane: thisPane,
    radius: 12,
    radiusRange: [ 12, 12],
    // radiusRange: [ 15, 22],
    opacity: 0.6,
    colorScaleExtent: [ 1, undefined ],
    radiusScaleExtent: [ null, null ],
    duration: 200,
    colorRange: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#a63603','#7f2704'],
    pointerEvents: 'none'
  }).lat(function(d) { return +d['lat']; })
    .lng(function(d) { return +d['lng']; })
    // .radiusValue(function(d) { return d.length; })
    .colorValue(function(d) {
      var avg = d3.max(d, function(f) {
        return +f.o.median;
      });
      return avg;
    })

  getData(options.path + 'data/nitrate.csv', function(data) {
    hexLayer.data(data);
  });

  // hexLayer.dispatch().on('click', function(d, i) {
	// 	console.log({ type: 'click', event: d, index: i, context: this });
  //   let stations = [];
  //   let avg = d3.max(d, function(f) {
  //     stations.push(f.o.station_id);
  //     return +f.o.median;
  //   });
  //   console.log(avg, stations);
  //   return avg;
	// });
  // hexLayer.setZIndex(400);
  return hexLayer;
};

var getLabelLayer = function(map, credits) {
  var labelPane = map.createPane('labelPane');
  var labelLayer = L.tileLayer(tiles.labels.url, {
      pane: labelPane,
      attribution: tiles.labels.attribution
  });
  labelPane.style.zIndex = 450;
  labelPane.style.pointerEvents = 'none';
  return labelLayer;
};


var AgrarNitratViz = function(el, options) {
  // select elements using jQuery since it is a dependency
  var $graphic = $(el);
  var $mapContainer = $graphic.find('.agrarnitrat-mapcontainer');
  var mapDiv = $graphic.find('.agrarnitrat-map')[0];

  var map = L.map(mapDiv, {
    scrollWheelZoom: false,
    zoomControl: false,
    dragging: false,
    // zoomAnimation: false,
    maxBounds: [[45.706179285330855, 2.5048828125],
            [56.6199765284502, 17.644042968749996]]
  });
  map.attributionControl.setPrefix('');

  var mapView = undefined;
  var setMapView = function(name, animate) {
    if (mapView === name) {
      return;
    }
    if (typeof name === 'object') {
      map.setView(name, animate);
      mapView = name;
      return
    }
    if (animate) {
      map.flyToBounds(bounds[name]);
    } else {
      map.fitBounds(bounds[name]);
    }
    mapView = name;
  };

  var layers = {}, currentLayer;
  var setTileLayer = function(name) {
    if (currentLayer !== name) {
      if (currentLayer) {
        map.removeLayer(layers[currentLayer]);
      }
      currentLayer = name;
      if (layers[currentLayer] == undefined) {
        layers[currentLayer] = L.tileLayer(tiles[currentLayer].url, {
          attribution: tiles[currentLayer].attribution
        });
      }
      layers[currentLayer].addTo(map);
    }
  };


  var stateLayer;
  var nitrateLayer = getNitrateLayer(map, {path: options.path});
  var credits = L.control.attribution().addTo(map);
  var farmMarkers = [];

  var labelLayer = getLabelLayer(map, credits);

  var initialSetup = {
    'map-1': function() {

      setMapView('germany');
      setTileLayer('base');
      stateLayer = getStateLayer(map, {path: options.path});
      stateLayer.addTo(map);
      // labelLayer.addTo(map);
      getData(options.path + 'data/betriebe.csv', function(data) {
        radiusScale.domain([0, d3.max(data, function(d) {
          return +d.nh3_yeartotal;
        })]);
        data.forEach(function(d, i){
          var marker = L.circleMarker([+d.lat, +d.lng], {
            stroke: false,
            fill: true,
            fillColor: '#3388ff',
            fillOpacity: 0.6,
            radius: 3
          }).bindTooltip(d.original_name)
          .on('click', function() {
            console.log(this);
          }).addTo(map);
          marker.data = d;
          farmMarkers.push(marker);
        })
      });

    },
    'map-2': function() {

      setMapView('uppergermany');
      setTileLayer('base');
      stateLayer = getStateLayer(map, {weight: 2, path: options.path});
      stateLayer.addTo(map);

    }
  };

  var storySteps = {
    intro: function() {
      setMapView('germany');
      setTileLayer('base');
    },
    zoomin: function() {
      setMapView('uppergermany', true);
      setTileLayer('base');
      farmMarkers.forEach(function(m) {
        m.setStyle({
          fillColor: '#3388ff'
        });
      });
    },
    subsidies: function() {
      setMapView('uppergermany');
      setTileLayer('base');
      farmMarkers.forEach(function(m) {
        m.setStyle({
          fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
        }).setRadius(3);
      });
    },
    scalenh3: function() {
      setMapView('uppergermany');
      setTileLayer('base');
      farmMarkers.forEach(function(m) {
        m.setRadius(radiusScale(m.data.nh3_yeartotal));
      });
    },
    wimex: function() {
      farmMarkers.forEach(function(m) {
        if (m.data.corp_uid === spots.wimex.uid) {
          m.setStyle({
            color: '#f00',
            weight: 3,
            stroke: true
          });
        } else {
          m.setStyle({
            stroke: false
          });
        }
      });
      // setTileLayer('satellite');
      // setMapView(spots.wimex.latlng, spots.wimex.zoom);
    },
    pelapro: function() {
      setTileLayer('satellite');
      setMapView(spots.pelapro.latlng, spots.pelapro.zoom);
    },
    gutlosten: function() {
      setTileLayer('satellite');
      setMapView(spots.gutlosten.latlng, spots.gutlosten.zoom);
    },
    vanasten: function() {
      setTileLayer('satellite');
      setMapView(spots.vanasten.latlng, spots.vanasten.zoom);
    },

    outro: function() {
      setMapView('uppergermany');
    },

    intro_2: function() {
      setMapView('uppergermany');
    },
    nitrate: function() {
      setMapView('uppergermany');
      nitrateLayer.addTo(map);
    },
  };
  var unblurSteps = {

  };

  initialSetup[$graphic.data('name')]();

  // viewport height
  var viewportHeight = window.innerHeight;
  var halfViewportHeight = Math.floor(viewportHeight / 2);

  // handle the fixed/static position of grahpic
  var toggle = function(fixed, bottom) {
    if (fixed) {
      $mapContainer.addClass('is-fixed');
    } else {
      $mapContainer.removeClass('is-fixed');
    }

    if (bottom) {
      $mapContainer.addClass('is-bottom');
    } else {
      $mapContainer.removeClass('is-bottom');
    }
  };

  // callback function when scrollStory detects item to trigger
  var handleItemFocus = function(event, item) {
    var step = item.data.step;
    var storyStepFunc = storySteps[step];
    if (storyStepFunc) {
      storyStepFunc();
    }
  };

  var handleItemBlur = function(even, item) {
    var step = item.data.step;
    var storyStepFunc = unblurSteps[step];
    if (storyStepFunc) {
      storyStepFunc();
    }
  };

  var handleContainerScroll = function(event) {
    var bottom = false;
    var fixed = false;

    var bb = $graphic[0].getBoundingClientRect();
    var bottomFromTop = bb.bottom - viewportHeight;

    if (bb.top < 0 && bottomFromTop > 0) {
      bottom = false;
      fixed = true;
    } else if (bb.top < 0 && bottomFromTop < 0) {
      bottom = true;
      fixed = false;
    }
    toggle(fixed, bottom);
  };

  $graphic.find('.agrarnitrat-stories').scrollStory({
      contentSelector: '.agrarnitrat-step',
      containerscroll: handleContainerScroll,
      itemfocus: handleItemFocus,
      itemblur: handleItemBlur
  });

};

module.exports = {
  AgrarNitratViz: AgrarNitratViz
};
if (global !== undefined) {
  global.AgrarNitratViz = AgrarNitratViz;
}
