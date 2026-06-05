const toDateOnly = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const getShuPeriodBounds = (dateInput) => {
  const d = toDateOnly(dateInput) || toDateOnly();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();

  const startYear = month >= 12 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    period_name: `SHU ${startYear}-${endYear}`,
    start_date: `${startYear}-12-01`,
    end_date: `${endYear}-11-30`,
  };
};

module.exports = {
  getShuPeriodBounds,
};
