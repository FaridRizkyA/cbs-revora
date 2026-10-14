// Local calendar date as "YYYY-MM-DD". toISOString() would give the UTC date,
// which is still yesterday before 07:00 in Indonesia (UTC+7).
const toLocalIsoDate = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

module.exports = {
  toLocalIsoDate,
};
