var socket = io({transports: ['websocket']});

var app = new Vue({
	el: '#app',
	data : {
		envios_server: '',
		infracciones_server: '',
		pagos_server: '',
		publicaciones_server: '',
		compras_server: '',
		web_server: ''
	},
	methods: {
		ejecutar: function(event){
			socket.emit('ejecutarSimulacionAUT');
		}
	}
});

socket.on('logMsg', function(data){
	//app.msgWeb = app.msgWeb + data.toString();
	var sentencia = 'app.'+data.origen + ' = app.'+data.origen+' + \'' + data.mensaje + '\';';
	console.log(sentencia);
	eval(sentencia);
});





