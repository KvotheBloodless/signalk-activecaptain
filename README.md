# SignalK Active Captain plugin


## Publishes points of interest (POI) from ActiveCaptain under `pointsOfInterest.activeCaptain.{id}`.
Here is an example:

```
{
  "name": "Lagoon Cove Marina",
  "position": {
    "latitude": 50.5985485022279,
    "longitude": -126.313741207123
  },
  "type": "Marina",
  "notes": "",
  "url": "https://activecaptain.garmin.com/en-US/pois/17411"
}
```

## Optionally publishes the same POIs as note resources accessible through the resources API.
Here is an example:
```
> curl -XGET "localhost:3000/signalk/v2/api/resources/notes/68093" | jq
{
  "name": "Lock #1 - Canal du Centre",
  "description": "Note 1 - Pk 48.8\rVertical drop 2.34m\n",
  "position": {
    "latitude": 46.75516272316218,
    "longitude": 4.505402798320954
  },
  "group": "Lock",
  "url": "https://activecaptain.garmin.com/en-US/pois/68093"
}
```

## Optionally publishes the same POIs as custom ac_* resources with the raw payload from ActiveCaptain, accessible through the resources API. 
Here is an example:
```
curl -XGET "localhost:3000/signalk/v2/api/resources/ac_Lock/68093" | jq
{
  "pointOfInterest": {
    "dateLastModified": "2014-08-07T11:34:21",
    "id": 68093,
    "mapLocation": {
      "latitude": 46.75516272316218,
      "longitude": 4.505402798320954
    },
    "name": "Lock #1 - Canal du Centre",
    "poiType": "Lock",
    "notes": [
      {
        "field": "PoiNotes",
        "value": "Pk 48.8\rVertical drop 2.34m"
      }
    ]
  }
}
```

POIs are searched within roughly 50km radius of the current location.
