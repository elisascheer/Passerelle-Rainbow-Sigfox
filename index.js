var express = require("express");
var pg=require("pg");
const fs = require('fs');
const output = require('d3node-output');
const d3 = require('d3-node')().d3;
const d3nLine = require('../');
var conString = process.env.DATABASE_URL;
var client = new pg.Client(conString);
client.connect();
const parseTime = d3.timeParse('%d-%b-%Y %H:%M:%S');
//console.log(parseTime('06-Apr-2018'));
var app = express();
/*code du serveur qui réceptionne les callbacks Sigfox*/
app.post("/", function(req, res) { 
    console.log("POST");
    var body = '';
    req.on('data', function (data) {
            body += data;
            console.log(" " + body);
    });
    req.on('end', function () {
            res.send("Data saved in the database successfully!\n")
    });
});
var test=client.query("select to_char(date,'dd-Mon-YYYY HH24:MI:SS') as date,data from temperature WHERE device='aaaa';");
//var test=client.query("select to_char(date,'dd-Mon-YYYY') as date,data from(select cast(t.date as date) as date, avg(t.data) as data from temperature t group by cast(t.date as date) order by cast(t.date as date) asc) as mean");
test.on("row",function(row,result){
    result.addRow(row);
});
test.on("end",function(result){
    //console.log(result.rows[0]);
    for(i=0;i<result.rows.length;i++){
        //result.rows[i].date.toString();
        console.log(result.rows[0].date);
        result.rows[i].date=(parseTime(result.rows[i].date));
        console.log(result.rows[i].date);
    }
    console.log(result.rows);
    const data=result.rows;
    //console.log(data);
    //console.log();
    output('./example/output', d3nLine({ data: data }));
})

/*const data = d3.tsvParse(tsvString, d => {
  return {
    date: parseTime(d.date),
    data: +d.close
  };
});*/
//console.log(data);
/*const data=[{"date":"06-Apr-2018","data":40.5},{"date":"07-Apr-2018","data":30.5},{"date":"08-Apr-2018","data":30.5},
{"date":"10-Apr-2018","data":40.5}];
// create output files*/
//output('./example/output', d3nLine({ data: data }));
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/output.html');
});

var port = process.env.PORT || 4000;
app.listen(port, function() {
    console.log("Listening on " + port);
});

