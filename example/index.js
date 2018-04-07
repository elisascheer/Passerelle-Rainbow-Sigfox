var express = require("express");
const fs = require('fs');
const output = require('d3node-output');
const d3 = require('d3-node')().d3;
const d3nLine = require('../');
var app = express();
var port = process.env.PORT || 5000;
app.post("/", function(req, res) { 
    console.log("POST");
    var body = '';
    req.on('data', function (data) {
            body += data;
            console.log(" " + body);
    });
});
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/output.html');
});
app.listen(port, function() {
    console.log("Listening on " + port);
});
var test=client.query("select to_char(date,'dd-Mon-YYYY') as date,data from(select cast(t.date as date) as date, avg(t.data) as data from temperature t group by cast(t.date as date) order by cast(t.date as date) asc) as mean");
test.on("row",function(row,result){
    result.addRow(row);
});
test.on("end",function(result){
    //console.log(result.rows[0]);
    for(i=0;i<result.rows.length;i++){
        //result.rows[i].date.toString();
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
    key: parseTime(d.date),
    value: +d.close
  };
});
*/
// create output files
//output('./example/output', d3nLine({ tab: tab }));
