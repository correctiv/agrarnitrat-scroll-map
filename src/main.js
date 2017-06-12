'use strict';

var L = require('leaflet');
var d3 = require('d3');
var topojson = require('topojson');

// Make jQuery global for jQuery.scrollstory
jQuery = $ = require('jquery');
require('scrollstory/dist/jquery.scrollstory.js');
require('@asymmetrik/leaflet-d3');
// require('leaflet.gridlayer.googlemutant/Leaflet.GoogleMutant.js');

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
    attribution: '© <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a><span> © <a href="https://www.digitalglobe.com/" target="_blank">DigitalGlobe</a></span> <a href="https://www.mapbox.com/feedback/" target="_blank">Improve this map</a>',
    mapbox: true
  },
  // google_satellite: L.gridLayer.googleMutant({type: 'satellite'})
};

var bounds = {
  germany: [[ 47.30903424774781, 5.888671875 ], [ 55.10351605801967, 15.161132812500002 ]],
  uppergermany: [[ 50.261253827584724, 5.5810546875 ], [ 54.97761367069628, 15.09521484375 ]],
  niedersachsen: [[52.17393169256849, 6.83349609375], [53.330872983017066, 9.5361328125]],
  schweineguertel: [  [ 52.60805152239317,7.495422363281249 ], [ 53.12040528310657,8.761596679687498 ], ],
  koethen: [ [ 51.47368506015889,11.460113525390623, ], [ 52.118312197617946, 12.440643310546875, ], ],
  losten: [ [ 53.753582905249914,11.306304931640625, ], [ 53.916067792813124,11.589889526367188, ], ]
};

var spots = {
  wimex: {
    latlng: [51.7094038,11.9838869],
    bounds: [ [ 51.70864951801032,11.982511281967163 ], [ 51.71115583372908, 11.987253427505493 ] ],
    zoom: 18,
    uid: 'a1b460ce-d350-4b02-8052-db280c6f2984'
  },
  pelapro: {
    latlng: [52.504663,11.1909762],
    bounds: [[ 52.50349421162272,11.191323995590208, ], [ 52.506021551780925, 11.194746494293213]],
    zoom: 18
  },
  gutlosten: {
    latlng: [53.7999991,11.4600634],
    bounds: [ [ 53.797495173905865,11.45517826080322], [ 53.80248834584996, 11.46873950958252]],
    zoom: 17
  },
  vanasten: {
    latlng: [51.4803159,10.7849659],
    bounds: [ [ 51.47773460456101,10.782008171081543, ], [ 51.482826095710024,10.79230785369873, ]],
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


var nh3RadiusScale = d3.scaleSqrt()
             .range([2, 10]);

var subsidiesRadiusScale = d3.scaleSqrt()
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
    colorScaleExtent: [ 50, 300],
    radiusScaleExtent: [ null, null ],
    duration: 200,
    colorRange: ['#fff5eb','#f16913','#d94801','#a63603','#7f2704'],
    pointerEvents: 'all'
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

  hexLayer.bindTooltip('CONTENT');
  hexLayer.dispatch().on('mouseover', function(d, i) {
    let stations = [];
    let avg = d3.max(d, function(f) {
      stations.push(f.o.station_id);
      return +f.o.median;
    });
    let lat = d3.mean(d, function(f) {
      return +f.o.lat;
    });
    let lng = d3.mean(d, function(f) {
      return +f.o.lng;
    });
    hexLayer.openTooltip(L.tooltip({}, hexLayer), [lat, lng])
    hexLayer.setTooltipContent('Höchster Median-Nitratwert: ' + Math.round(avg) + ' mg/l')
	});
  hexLayer.dispatch().on('mouseout', function(d, i) {
    hexLayer.closeTooltip();
  });

  return hexLayer;
};

var getLabelLayer = function(map, credits) {
  var labelPane = map.createPane('labelPane');
  var labelLayer = L.tileLayer(tiles.labels.url, {
      pane: labelPane,
      attribution: tiles.labels.attribution
  });
  labelPane.style.zIndex = 610;
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
    doubleClickZoom: false,
    touchZoom: false,
    keyboard: false,
    boxZoom: false,
    // zoomAnimation: false,
    maxBounds: [[45.706179285330855, 2.5048828125],
            [56.6199765284502, 17.644042968749996]]
  });
  var zoomControl = L.control.zoom();
  map.attributionControl.setPrefix('');

  L.MapboxWordmark = L.Control.extend({
    onAdd: function(map) {
      this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
      this._container.innerHTML = '<a href="http://mapbox.com/about/maps" class="mapbox-wordmark" target="_blank">Mapbox</a>';
      return this._container;
    }
  });

  var mapBoxWordMark = new L.MapboxWordmark({
    position: 'bottomleft',
  });

  var mapView = undefined;
  var setMapView = function(name, animate) {
    if (mapView === name) {
      return;
    }
    if (typeof name === 'object') {
      map.fitBounds(name);
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
        if (!(tiles[currentLayer] instanceof L.Layer)) {
          layers[currentLayer] = L.tileLayer(tiles[currentLayer].url, {
            attribution: tiles[currentLayer].attribution
          });
        } else {
          layers[currentLayer] = tiles[currentLayer];
        }
      }
      if (tiles[currentLayer].mapbox) {
        mapBoxWordMark.addTo(map);
      } else {
        mapBoxWordMark.remove();
      }
      layers[currentLayer].addTo(map);
    }
  };


  var stateLayer;
  var markerPane = map.createPane('markerPane');
  var nitrateLayer = getNitrateLayer(map, {path: options.path});
  var credits = L.control.attribution().addTo(map);
  var farmMarkers = [];

  getData(options.path + 'data/betriebe.csv', function(data) {
    nh3RadiusScale.domain([0, d3.max(data, function(d) {
      return +d.nh3_yeartotal;
    })]);
    subsidiesRadiusScale.domain([0, d3.max(data, function(d) {
      return +d.total_subsidies;
    })]);
    data.forEach(function(d, i){
      var marker = L.circleMarker([+d.lat, +d.lng], {
        pane: markerPane,
        stroke: false,
        fill: true,
        fillColor: '#3388ff',
        fillOpacity: 0.6,
        radius: 3
      }).bindTooltip(d.original_name + ': ' + (d.nh3_yeartotal / 1000) + ' t NH3 (2011-2015)')
      .on('click', function() {
        console.log(this);
      }).addTo(map);
      marker.data = d;
      farmMarkers.push(marker);
    });
  });

  var labelLayer = getLabelLayer(map, credits);

  var initialSetup = {
    'map-1': function() {

      setMapView('germany');
      setTileLayer('base');
      stateLayer = getStateLayer(map, {path: options.path});
      stateLayer.addTo(map);
      // labelLayer.addTo(map);

    },
    'map-2': function() {
      markerPane.style.display = 'none';
      setMapView('uppergermany');
      setTileLayer('base');
      stateLayer = getStateLayer(map, {weight: 2, path: options.path});
      stateLayer.addTo(map);
      labelLayer.addTo(map);
      nitrateLayer.addTo(map);

    }
  };

  var MARKER_INITIAL_SIZE = 3;

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
        }).setRadius(MARKER_INITIAL_SIZE);
      });
      markerPane.style.display = 'block';
    },
    scalenh3: function() {
      setMapView('uppergermany');
      setTileLayer('base');
      // d3.selectAll(farmMarkers).interrupt().transition().tween('markers.radius', function() {
      //   var m = this, nowSize = m.getRadius(), finalSize = nh3RadiusScale(m.data.nh3_yeartotal);
      //   return function(t) {
      //     m.setRadius(nowSize + t * (finalSize - nowSize));
      //   };
      // }).on('end', function(){
      //
      // });
      farmMarkers.forEach(function(m) {
         m.setRadius(nh3RadiusScale(m.data.nh3_yeartotal))
         m.setStyle({
          fillColor: '#3388ff',
          fillOpacity: 0.6,
        })
      });
      markerPane.style.display = 'block';
    },
    subsidies: function() {
      setMapView('uppergermany');
      setTileLayer('base');
      farmMarkers.forEach(function(m) {
        m.setStyle({
          fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388',
          fillOpacity: 0.6,
        })
      });
      markerPane.style.display = 'block';
    },
    wimex: function() {
      markerPane.style.display = 'block';
      farmMarkers.forEach(function(m) {
        if (m.data.corp_uid !== spots.wimex.uid) {
          m.setStyle({
            fillOpacity: 0.1,
            // stroke: true
          });
        }
      });
      setTileLayer('base');
      setMapView('germany');
      // setMapView(spots.wimex_overview.bounds);
    },
    wimex_detail: function() {
      markerPane.style.display = 'none';
      // farmMarkers.forEach(function(m) {
      //   if (m.data.corp_uid === spots.wimex.uid) {
      //     m.setStyle({
      //       color: '#f00',
      //       weight: 3,
      //       stroke: true
      //     });
      //   } else {
      //     m.setStyle({
      //       stroke: false
      //     });
      //   }
      // });
      setTileLayer('satellite');
      setMapView(spots.wimex.bounds);
    },
    // pelapro: function() {
    //   setTileLayer('satellite');
    //   setMapView(spots.pelapro.bounds);
    //   markerPane.style.display = 'none';
    // },
    gutlosten: function() {
      setTileLayer('satellite');
      setMapView(spots.gutlosten.bounds);
      markerPane.style.display = 'none';
    },
    vanasten: function() {
      setTileLayer('satellite');
      setMapView(spots.vanasten.bounds);
      markerPane.style.display = 'none';
    },

    nitrat_intro: function() {
      setMapView('germany');
      nitrateLayer.addTo(map);
      markerPane.style.display = 'none';
    },

    nitrat: function() {
      setMapView('uppergermany');
      nitrateLayer.addTo(map);
      markerPane.style.display = 'none';
    },
    region_1: function() {
      // map.removeLayer(nitrateLayer);
      setMapView('schweineguertel');
      markerPane.style.display = 'none';
    },
    region_1_detail: function() {
      // map.removeLayer(nitrateLayer);
      setMapView('schweineguertel');

      farmMarkers.forEach(function(m) {
        m.setStyle({
          fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
        }).setRadius(nh3RadiusScale(m.data.nh3_yeartotal) * 2);
      });
      markerPane.style.display = 'block';
    },
    region_2: function() {
      // map.removeLayer(nitrateLayer);
      setMapView('koethen');

      map.on('zoomend', function(){
        if (currentStoryStep !== 'region_2') { return; }
        farmMarkers.forEach(function(m) {
          m.setStyle({
            fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
          }).setRadius(nh3RadiusScale(m.data.nh3_yeartotal) * 2);
        });
        markerPane.style.display = 'block';
      });
    },
    region_3: function() {
      nitrateLayer.addTo(map);

      zoomControl.remove();

      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      if (map.tap) map.tap.disable();
      setMapView('losten');

      map.on('zoomend', function(){
        if (currentStoryStep !== 'region_3') { return; }
        farmMarkers.forEach(function(m) {
          m.setStyle({
            fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
          }).setRadius(nh3RadiusScale(m.data.nh3_yeartotal) * 2);
        });
        markerPane.style.display = 'block';
      });
    },
    interactive: function() {
      setMapView('uppergermany');
      map.removeLayer(nitrateLayer);
      zoomControl.addTo(map);
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();
      if (map.tap) map.tap.enable();

      farmMarkers.forEach(function(m) {
        m.setStyle({
          fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
        }).setRadius(nh3RadiusScale(m.data.nh3_yeartotal));
      });
      markerPane.style.display = 'block';

      map.on('zoomend', function(){
        if (currentStoryStep !== 'interactive') { return; }
        if (map.getZoom() > 9) {
          nitrateLayer.addTo(map);
          farmMarkers.forEach(function(m) {
            m.setStyle({
              fillColor: +m.data.has_local_subsidies === 0 ? '#3388ff' : '#ff3388'
            }).setRadius(nh3RadiusScale(m.data.nh3_yeartotal) * 2);
          });
        } else {
          map.removeLayer(nitrateLayer);
        }
      });
    }
  };
  var unblurSteps = {

  };

  initialSetup[$graphic.data('name')]();

  // callback function when scrollStory detects item to trigger
  var currentStoryStep;
  var handleItemFocus = function(event, item) {
    var step = item.data.step;
    var storyStepFunc = storySteps[step];
    if (storyStepFunc) {
      currentStoryStep = step;
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

  // viewport height
  var viewportHeight = window.innerHeight;
  var halfViewportHeight = Math.floor(viewportHeight / 2);
  var originalLeft = $mapContainer.offset().left;
  var originalWidth = $mapContainer.width();
  var screenWidth = $(window).width();

  var isFixed = false, isBottom = false;

  var t = d3.transition()
    .duration(2000)
    .ease(d3.easeLinear);

  // handle the fixed/static position of grahpic
  var toggle = function(fixed, bottom) {
    var changed, fixedChanged, bottomChanged;

    fixedChanged = isFixed != fixed;
    bottomChanged = isBottom != bottom;
    changed = fixedChanged || bottomChanged;
    isFixed = fixed;
    isBottom = bottom;
    if (changed) {

      if (fixedChanged) {
        if (fixed) {

          $mapContainer.css({left: originalLeft + 'px', width: originalWidth + 'px'});

          $mapContainer.addClass('is-fixed');
          d3.select($mapContainer[0]).interrupt().transition(t)
            .style('left', '0px').style('width', screenWidth + 'px')
            .attrTween('data-map', function() {
              return function(t) {
                map.invalidateSize();
                return '';
              };
            })
            .on('end', function() {
              map.invalidateSize();
            })

        } else {
          d3.select($mapContainer[0]).interrupt().transition(t)
            .style('left', originalLeft + 'px').style('width', originalWidth + 'px')
            .attrTween('data-map', function() {
              return function(t) {
                map.invalidateSize();
                return '';
              };
            })
            .on('end', function() {
              $mapContainer.css({left: 'inherit', width: '100%'});
              $mapContainer.removeClass('is-fixed');
              map.invalidateSize();
            })
        }
      }
      if (bottomChanged) {
        if (bottom) {
          $mapContainer.addClass('is-bottom');
        } else {
          $mapContainer.removeClass('is-bottom');
        }
      }
      map.invalidateSize();
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
