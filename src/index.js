const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const parseSync = require("csv-parse/lib");

const countries = require("../dist/countries.json");

const parse = util.promisify(parseSync);

const WORKING_DIR = process.env.GITHUB_WORKSPACE || "./";

const fileNames = [
  "time_series_covid19_confirmed_global.csv",
  "time_series_covid19_deaths_global.csv"
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

function mergeTimeseries(oldSeries = [], newSeries = []) {
  if (oldSeries.length > 0) {
    return oldSeries.reduce((prev, curr, i) => {
      return [
        ...prev,
        {
          ...curr,
          confirmed:
            (curr.confirmed || 0) +
            ((newSeries[i] && newSeries[i].confirmed) || 0),
          deaths:
            (curr.deaths || 0) + ((newSeries[i] && newSeries[i].deaths) || 0)
        }
      ];
    }, []);
  }

  return newSeries;
}

async function getTimeseriesJSON() {
  const [[confirmed, dates], [deaths]] = await Promise.all(
    fileNames.map(fileName => getSingleJSON(fileName))
  );

  const result = Object.keys(confirmed).reduce((prev, country, i) => {
    const timeseries = dates.reduce((prevDate, date) => {
      const [month, day, year] = date.split("/");

      return [
        ...prevDate,
        {
          date: `${year}-${month}-${day}`,
          confirmed: (confirmed[country] && confirmed[country][date]) || 0,
          deaths:
            (deaths[country] &&
              deaths[country][
                `${month}/${day}/${
                  year.length === 4 ? year.substring(2) : year
                }`
              ]) ||
            0
        }
      ];
    }, []);

    let useCountry = country;
    if (!countries[country]) {
      useCountry = "Unknown";
    }

    return {
      ...prev,
      [countries[useCountry].code]: {
        name: countries[useCountry].translation,
        lat: confirmed[country].lat,
        long: confirmed[country].long,
        jhuName: useCountry,
        timeseries: mergeTimeseries(
          (prev[countries[useCountry].code] &&
            prev[countries[useCountry].code].timeseries) ||
            [],
          timeseries
        )
      }
    };
  }, {});

  return result;
}

async function writeJSON() {
  try {
    const dataTimeseries = await getTimeseriesJSON();

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
  } catch (error) {
    process.exitCode = 1;
    console.error(error);
  }
}

writeJSON();
