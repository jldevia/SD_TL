var express = require('express');
var app = express();
var shttp = require('http').Server(app);
var path = require('path');
var Monitor = require('./monitor');

var monitor = new Monitor(shttp);

shttp.listen(17850, function (){
	console.log('Server escuchando en el puerto 17850...');
});

app.use(express.static(path.join(__dirname, 'public')));



