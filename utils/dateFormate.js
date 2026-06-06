function formatDate(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

function getDateFilter(dateRange = "today") {
  let start, end;
 const today = getISTDate();
  
    // console.log(today,"todaytodaytoday")
  //   const date = new Date("2025-10-17T00:00:00+05:30");
  // console.log(date,"datatatata"); 
  // today.setHours(0, 0, 0, 0);
  switch (dateRange) {
    case "today":
      start = formatDate(today);
      end = formatDate(today);
      break;

    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      start = formatDate(yesterday);
      end = formatDate(yesterday);
      break;

    case "last7":
      const last7End = new Date(today);
      last7End.setDate(last7End.getDate() - 1); // 👈 exclude today
      const last7Start = new Date(last7End);
      last7Start.setDate(last7End.getDate() - 6); // 7 din
      start = formatDate(last7Start);
      end = formatDate(last7End);
      break;

    case "thisMonth":
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      start = formatDate(thisMonthStart);
      end = formatDate(today);
      break;

    case "lastMonth":
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      start = formatDate(lastMonthStart);
      end = formatDate(lastMonthEnd);
      break;
  }

  // Generate array of dates
  const dateArray = [];
  let current = start;

  while (current <= end) {
    dateArray.push(current);
    const parts = current.split("-").map(Number);
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    current = formatDate(d);
  }

  return { $in: dateArray };
}

const getLocalDateString = (date) => {
  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
};
function getISTDate() {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000; // +05:30 in ms
  return new Date(now.getTime() + offset);
}

function getDatesArray(start, end) {
  const result = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    // use IST formatting
    const formatted = getLocalDateString(current); // "DD/MM/YYYY"

    // optional: convert to "YYYY-MM-DD" format for MongoDB
    const [day, month, year] = formatted.split("/");
    result.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);

    current.setDate(current.getDate() + 1);
  }
  return result;
}

module.exports = { getDateFilter, getDatesArray };
