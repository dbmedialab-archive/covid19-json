const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const parseSync = require("csv-parse/lib");

const countries = require("../dist/countries.json");

const parse = util.promisify(parseSync);

const WORKING_DIR = process.env.GITHUB_WORKSPACE || "./";

const fileNames = [
  "time_series_19-covid-Confirmed.csv",
  "time_series_19-covid-Deaths.csv",
  "time_series_19-covid-Recovered.csv"
];

async function getSingleJSON(fileName) {
  const csv = await fs.readFile(
    path.resolve(
      WORKING_DIR,
      "data",
      "csse_covid_19_data",
      "csse_covid_19_time_series",
      fileName
    )
  );

  const [headers, ...rows] = await parse(csv);
  const [, , , , ...dates] = headers;

  const result = rows.reduce(
    (prev, [province, country, lat, long, ...counts]) => {
      // Fix some weirdness like Greenland not counting as own country
      switch (province) {
        case "Greenland":
          country = province;
          break;
        case "Faroe Islands":
          country = province;
          break;
        default:
          country = country;
      }

      return {
        ...prev,
        [country]: dates.reduce(
          (prevDates, date, i) => {
            return {
              ...prevDates,
              [date]:
                parseInt((prev[country] && prev[country][date]) || 0) +
                parseInt(counts[i] || 0)
            };
          },
          {
            lat,
            long
          }
        )
      };
    },
    {}
  );

  return [result, dates];
}

async function getTimeseriesJSON() {
  const [[confirmed, dates], [deaths], [recovered]] = await Promise.all(
    fileNames.map(fileName => getSingleJSON(fileName))
  );

  const result = Object.keys(confirmed).reduce((prev, country, i) => {
    const timeseries = dates.reduce((prevDate, date) => {
      const [month, day, year] = date.split("/");

      return [
        ...prevDate,
        {
          date: `20${year}-${month}-${day}`,
          confirmed: confirmed[country][date],
          deaths: deaths[country][date],
          recovered: recovered[country][date]
        }
      ];
    }, []);

    return {
      ...prev,
      [countries[country].code]: {
        name: countries[country].translation,
        lat: confirmed[country].lat,
        long: confirmed[country].long,
        jhuName: country,
        timeseries
      }
    };
  }, {});

  return result;
}

async function getTotalsJSON() {
  const [[confirmed, dates], [deaths], [recovered]] = await Promise.all(
    fileNames.map(fileName => getSingleJSON(fileName))
  );

  const result = Object.keys(confirmed).reduce((prev, country, i) => {
    const totals = dates.reduce((prevTotal, date) => {
      return {
        confirmed: confirmed[country][date],
        deaths: deaths[country][date],
        recovered: recovered[country][date]
      };
    }, {});

    return {
      ...prev,
      [countries[country].code]: {
        name: countries[country].translation,
        lat: confirmed[country].lat,
        long: confirmed[country].long,
        jhuName: country,
        totals
      }
    };
  }, {});

  return result;
}

async function writeJSON() {
  const dataTimeseries = await getTimeseriesJSON();
  const dataTotals = await getTotalsJSON();

  const outputPathTimeseriesPretty = path.join(
    WORKING_DIR,
    "dist",
    "timeseries-pretty.json"
  );
  const outputPathTimeseriesMinified = path.join(
    WORKING_DIR,
    "dist",
    "timeseries.json"
  );

  await fs.writeFile(
    outputPathTimeseriesPretty,
    JSON.stringify(dataTimeseries, null, 2)
  );
  await fs.writeFile(
    outputPathTimeseriesMinified,
    JSON.stringify(dataTimeseries)
  );

  const outputPathTotalsPretty = path.join(
    WORKING_DIR,
    "dist",
    "totals-pretty.json"
  );
  const outputPathTotalsMinified = path.join(
    WORKING_DIR,
    "dist",
    "totals.json"
  );

  await fs.writeFile(
    outputPathTotalsPretty,
    JSON.stringify(dataTotals, null, 2)
  );
  await fs.writeFile(outputPathTotalsMinified, JSON.stringify(dataTotals));
}

writeJSON();
