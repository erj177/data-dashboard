let combined
let datapoints = [];
let datapoints2 = [];
let tickers = [];
let times = [];

/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
/*------------------------------------------------------------------------------------------Parent function-----------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

async function goFunction() {
  //get selected stocks from form element and arrange into array
  const selectedOptions = document.getElementById('main-box').options;
  const type = document.getElementById('type-box').value;
  const startdate = document.getElementById('start').value;
  const enddate = document.getElementById('end').value;
  if(startdate == "" || enddate == "") {
    document.getElementById('test').innerHTML = "Please enter a valid date range.";
    return;
  }

  const stocks = [];
  for (let i=0; i<selectedOptions.length; i++) {
    if (type.includes("fx-")) {
      stocks.push("C:"+selectedOptions[i].value);
    } else if (type.includes("crypto-")) {
      stocks.push("X:"+selectedOptions[i].value);
    } else {
      stocks.push(selectedOptions[i].value);
    }
  }


  //clear the error message area at the bottom of the form, in case errors from previous requests are still there
  document.getElementById("test").innerHTML = "";
  //try the API calls, catch errors
  try {
    const receivedData = await callStockApi(stocks,startdate,enddate);
      tidyStock(receivedData, type);
      chartingFunction(datapoints,times,tickers);
      $(".collapse").collapse("toggle");
  } catch (error) {
    if (error==429) {
      document.getElementById("test").innerHTML = "Too many requests. Only data for 5 stocks can be retrieved per minute. This includes multiple stocks in the same request.";
    } else if (error=="TypeError: reduce of empty array with no initial value"){
      document.getElementById("test").innerHTML = "Please enter a dataset."
    } else {
      document.getElementById("test").innerHTML = "Error: " + error + "<br>" + "Please report this error to ethanmagill@gmail.com, quoting the error code above.";
    }
  }
}


/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------API call functions---------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

async function callStockApi(stocks,startdate,enddate) {
  const myData = [];

  for(i in stocks) {
    //define url for request using form data
    const url = "https://api.polygon.io/v2/aggs/ticker/" + stocks[i] + "/range/1/day/" + startdate + "/" + enddate + "?adjusted=true&sort=asc&limit=50000&apiKey=csyFJEpd7HmwveZ84lnv1Ixf5T2n1tc_";
    //do axios query to the API using the url
    try {
      const singleStock = await axios.get(url);
      myData.push(singleStock['data']);
    } catch (error) {
      if (error.response) {
        throw error.response.status;
      } else if (error.request){
        throw new Error(error.request);
      } else {
        throw new Error("Not sure what happened there but that didn't work");
      }
    }
  }
  return myData;
}

/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------Charting Functions---------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

function tidyStock(receivedData, type) {
  //Get volume vs price info from the GET header, and convert it into 'v' or 'c' (since this is the format used by the API)
  let type_format;

  if(type.includes("-volume")){
    type_format = "v";
  }
  if (type.includes("-price")){
    type_format = "c";
  }
  //emptying the global arrays
  datapoints = [];
  tickers = [];
  times = [];

  //This loop extracts three arrays from the API data. First, a times_array that contains an array of time observations for each stock (e.g., if the user has entered three stocks, there will be three arrays in times_array, each with the list of time observations for that stock). Second, a datapoints_array that does the same thing as the times_array but for the actual datapoints. Third, a tickers array that just lists the tickers that have been requested.
  const times_array = [];
  const datapoints_array = [];

  for(let i in receivedData) {
    const datapoints_temp = [];
    const times_temp = [];
    for(let j in receivedData[i]['results']){
      datapoints_temp.push(receivedData[i]['results'][j][type_format]);
      const input = receivedData[i]['results'][j]['t'];
      const temp_date = new Date(Number(input));
      times_temp.push(temp_date.toDateString());
    }
    times_array.push(times_temp);
    datapoints_array.push(datapoints_temp);
    tickers.push(receivedData[i]['ticker']);
  }

  //This code combines the multiple arrays in times_array into one single array that has all observations across the multiple stock tickers entered (removing duplicates as needed). It then sorts them by date to make sure they're in the right order.
  times = times_array.reduce(function(total,next) {
    let a = total.concat(next);
    for(let i=0; i<a.length; ++i) {
      for(let j=i+1; j<a.length; ++j) {
        if(a[i] === a[j]) {
          a.splice(j--, 1);
        }
      }
    }
    return a;
  }).sort(function(x,y){
    const date1 = new Date(x);
    const date2 = new Date(y);
    return date1 - date2;
  })

  //This loop re-arranges the datapoints_array so that there are "null" elements in slots where there are observations for some stocks but not others. I.e., if one stock was trading on a specific date, but another was not, this code will ensure that the chart data lines up with the correct dates regardless.
  for (let i in times_array) {
    const datapoints_temp = [];
    for (let j in times) {
      let searchItem = times[j];
      if (times_array[i].indexOf(searchItem) === -1) {
      	datapoints_temp.push(null);
      } else {
      	datapoints_temp.push(datapoints_array[i][times_array[i].indexOf(searchItem)]);
      }

    }
    datapoints.push(datapoints_temp);
  }

  //Putting all my arrays in a nice combined array (isn't really necessary, but helpful for downloads later)
  combined = {times,tickers,datapoints};
}

function chartingFunction(datapoints,times,tickers) {
  //Make the containers visible
  document.getElementById('container').style.visibility = 'visible';
  document.getElementById('buttons').style.visibility = 'visible';

  //Convert the data into the chartjs format
  const dataset = [];
  for (let i in datapoints) {
    const new_data = {
      label: tickers[i],
      data: datapoints[i],
      fill:false,
      borderColor: colors[i],
      tension: 0.1
    }
    dataset.push(new_data);
  }

  //Destroy chart from previous requests, if it exists
  const chartStatus = Chart.getChart("myChart");
  if(chartStatus) {
    chartStatus.destroy();
  }

  //Chart the data
  const ctx = document.getElementById('myChart').getContext('2d');
  const myChart = new Chart(ctx, {
    type: 'line',
    data: {
     labels: times,
     datasets: dataset
    },
    options: {
      spanGaps: true,
      maintainAspectRatio: false,
      responsive: true
    }
  });
}



/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------Download Functions---------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

function downloadJson(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], {type: 'application/json'});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}


function downloadCSV(datapoints, times, fileName) {
  let fullData = "times,datapoints" + "\r\n";
  for (let i in datapoints){
    fullData += times[i] + "," + datapoints[i] + "\r\n";
  }
  const a = document.createElement("a");
  const file = new Blob([fullData], {type: 'text/csv'});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}


function downloadCSVstock(datapoints, times, tickers, fileName) {
  let fullData = "times";
  for(let i in tickers) {
    fullData += "," + tickers[i];
  }
  fullData += "\r\n";
  for (let i in times){
    fullData += times[i];
    for (let j in datapoints) {
      fullData += "," + datapoints[j][i];
    }
    fullData += "\r\n";
  }
  const a = document.createElement("a");
  const file = new Blob([fullData], {type: 'text/csv'});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------Other / Old-------------------------------------------------------------------------------------------------------*/
/*--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

function chartFunction(y, x, legend) {
  //document.getElementById('test').innerHTML = y[1];
  var label = legend;
  var datapoint = y;
  var time = x;
  var dataset = [{
      label: label,
      data: datapoint,
      fill:false,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
  }];
  const ctx = document.getElementById('myChart').getContext('2d');
  const myChart = new Chart(ctx, {
    type: 'line',
    data: {
     labels: time,
     datasets: dataset
   },
   options: {

     maintainAspectRatio: false
   }
 });
}

function getUnique(a) {
  for(let i=0; i<a.length; ++i) {
    for(let j=i+1; j<a.length; ++j) {
      if(a[i] === a[j]) {
        a.splice(j--, 1);
      }
    }
  }
  return a;
}


  var colors = [
    'rgb(75,192,192)',
    'rgb(255,51,153)',
    'rgb(0,204,102)',
    'rgb(204,0,0)',
    'rgb(255,128,0)',
    'rgb(255,255,51)',
    'rgb(0,128,255)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)',
    'rgb(75,192,192)'
  ];
