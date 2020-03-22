# COVID19-JSON

Turns the CSV data from [John Hopkis CSSE](https://github.com/CSSEGISandData/COVID-19) into JSON every 3 hours.

## Files

`dist/totals.json` - Summary in the form of

```json
{
  "TH": {
    "name": "Thailand",
    "lat": "15",
    "long": "101",
    "jhuName": "Thailand",
    "totals": {
      "confirmed": 411,
      "deaths": 1,
      "recovered": 42
    }
  }
}
```

`dist/timeseries.json` - Timeseries data in the form of

```json
{
  "TH": {
    "name": "Thailand",
    "lat": "15",
    "long": "101",
    "jhuName": "Thailand",
    "timeseries": [
      {
        "date": "2020-1-22",
        "confirmed": 2,
        "deaths": 0,
        "recovered": 0
      },
      {
        "date": "2020-1-23",
        "confirmed": 3,
        "deaths": 0,
        "recovered": 0
      },
      ...
```
