/*
 * Copyright 2022 Ilker Temir <ilker@ilkertemir.com>
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//import { ResourceProvider } from '@signalk/server-api'
// const { ResourceProvider } = require('@signalk/server-api');

const request = require('request');
const poiKey = 'pointsOfInterest.activeCaptain';
const userAgent = 'Signal K ActiveCaptain Plugin';
const checkEveryNMinutes = 15;

module.exports = function(app) {

  const plugin = {
    id: "signalk-activecaptain",
    name: "ActiveCaptain",
    description: "Publishes ActiveCaptain Points of Interest" 
  };
  var pois = {};

  plugin.start = function(options) {
    // Position data is not immediately available, delay it
    setTimeout( function() {
      checkAndPublishPois();
    }, 15000);

    setInterval( function() {
      checkAndPublishPois();
    }, checkEveryNMinutes * 60 * 1000);

    // Register as a resource provider
    try {
      app.registerResourceProvider({
        type: 'waypoints',
        methods: {
          listResources: (params) => { 
            app.debug(`List`)
            return new Promise((resolve, reject) => {
              reject(new Error('Still testing'))
            })
          },
          getResource: (id, property) => { 
            app.debug(`Get`)
            return new Promise((resolve, reject) => {
              reject(new Error('Still testing'))
            })
          },
          setResource: (id, value) => { 
            throw(new Error('Not implemented!'))
          },
          deleteResource: (id) => { 
            throw(new Error('Not implemented!'))
          }
        }
      });
    } catch (error) {
      app.debug(`Cannot register as a resource provider ${error}`);
    }
  }

  plugin.stop =  function() {
  };

  plugin.schema = {
    type: 'object',
    required: [],
    properties: {
      resources: {
        type: 'boolean',
        title: 'Also publish activecaptain points of interest as note resources using the resource API',
        default: true
      }
    }
  }

  function calculateNewPosition(latitude, longitude, bearing, distance) {
    const earthRadius = 6371; // Radius of the Earth in kilometers
    const latitudeRad = toRadians(latitude);
    const longitudeRad = toRadians(longitude);
    const bearingRad = toRadians(bearing);

    const newLatitudeRad = Math.asin(Math.sin(latitudeRad) * Math.cos(distance / earthRadius) +
      Math.cos(latitudeRad) * Math.sin(distance / earthRadius) * Math.cos(bearingRad));

    const newLongitudeRad = longitudeRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / earthRadius) * Math.cos(latitudeRad),
      Math.cos(distance / earthRadius) - Math.sin(latitudeRad) * Math.sin(newLatitudeRad));

    const newLatitude = toDegrees(newLatitudeRad);
    const newLongitude = toDegrees(newLongitudeRad);

    return { latitude: newLatitude, longitude: newLongitude };
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  function checkAndPublishPois() {
    let position = app.getSelfPath('navigation.position');
    if (!position) {
      app.debug(JSON.stringify(position));
      return;
    }
    let lat = position.value.latitude;
    let lng = position.value.longitude;
    retrievePois(lat,lng);
  }

  function emitSignalKMessage(poi) {
    let poiData = {
      name: poi.name,
      position: poi.position,
      type: poi.type,
      notes: poi.notes,
      url: poi.url
    }
    let values = [{
         path: `${poiKey}.${poi.id}`,
         value: poiData
    }]
    app.handleMessage(plugin.id, {
      updates: [
        {
          values: values
        }
      ]
    });
  }

  function retrievePoiDetails(poi) {
    if (poi.id in pois) {
      app.debug(`POI details for ID ${poi.id} already known, used cached values`);
      emitSignalKMessage(pois[poi.id]);
      return;
    }
    app.debug(`Retrieving POI details for ID ${poi.id} and will cache`);
    let url=`https://activecaptain.garmin.com/community/api/v1/points-of-interest/${poi.id}/summary`;
    request.get({
      url: url,
      json: true,
      headers: {
        'User-Agent': userAgent,
      }
    }, function(error, response, data) {
      if (!error && response.statusCode == 200) {
        if (!data.pointOfInterest) {
          app.debug(`Cannot decode response for POI ${poi.id}: ${JSON.stringify(data)}`);
          return;
        }

        let notes;
        if ((data.pointOfInterest.notes) && (data.pointOfInterest.notes[0])) {
          notes = data.pointOfInterest.notes[0].value;
          // We don't want to trash SignalK with a ton of text
          const lengthLimit = 280;
          if (notes.length > lengthLimit) {
            notes = notes.slice(0, lengthLimit)+'...';
          }
        } else {
          notes = '';
        }

        pois[poi.id] = {
          id: poi.id,
          name: data.pointOfInterest.name,
          position: data.pointOfInterest.mapLocation,
          type: data.pointOfInterest.poiType,
          notes: notes,
          url: `https://activecaptain.garmin.com/en-US/pois/${poi.id}`
        }
        emitSignalKMessage(pois[poi.id]);
        app.debug(`Published details for POI ${poi.id}`);
      } else {
        app.debug(`Error retrieving ${url}: ${JSON.stringify(response)}`);
      }
    });
  }

  function retrievePois(lat, lng) {
    let url=`https://activecaptain.garmin.com/community/api/v1/points-of-interest/bbox`;
    // Calculate the coordinates of the "box" that we will use to retrieve the POIs
    // This is a rectangle with 200km diagonal length
    const radius = 50;
    let nwCoords = calculateNewPosition(lat, lng, -45, radius);
    let seCoords = calculateNewPosition(lat, lng, 135, radius);
    request.post({
      url: url,
      json: true,
      headers: {
        'User-Agent': userAgent,
      },
      json: {
        // This is a super crude way of calculating "distance" but will do for now unless people go to the poles
        'north': nwCoords.latitude,
        'west': nwCoords.longitude,
        'south': seCoords.latitude,
        'east': seCoords.longitude,
        'zoomLevel': 17 // Get granular
      }
    }, function(error, response, data) {
      if (!error && response.statusCode == 200) {
        app.debug(`POIs received ${JSON.stringify(data)}`);
        if (!data.pointsOfInterest) {
          return;
        }
        data.pointsOfInterest.map( poiSummary => {
          retrievePoiDetails(poiSummary); 
        });
      } else {
        app.debug(`Error retrieving stations ${JSON.stringify(response)}`);
      }
    });
  }
  return plugin;
}
