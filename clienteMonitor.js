console.log('Conectando con monitor...');

var socket = require('socket.io-client')('http://localhost:17850');

socket.on('listadoCompras', function(data){
	console.log('**********************');
	console.log('Servidor: ' + data.origen);
	console.log('Listado Compras: ' + data.listado_compras);
	console.log('**********************');
});

socket.on('estadoCompra', function(data){
	console.log('**********************');
	console.log('Servidor: ' + data.origen);
	console.log('N° Compra: ' + data.num_compra);
	console.log('Estado: ' + data.estado);
	console.log('Prox. Evento: ' + data.prox_eventos);
	console.log('**********************');
});

//Se inicializan los servidores en el modo correspondiente
var modo_ini = process.argv[2] || 'XXXX'; 

switch (modo_ini) {
case 'AUT':{
	socket.emit('ejecutarSimulacionAUT');
	console.log('Monitor en ejecucion en modo AUTOMATICO');
	break;}
case 'PAP':{
	socket.emit('ejecutarSimulacionPAP');
	console.log('Monitor en ejecución en modo PAP');
	break;}
default:{
	console.log('Modo de inicio desconocido!!!');
	process.exit(1);
}
}

function imprimirMenu(){
	console.log('******************************************************');
	console.log('Menu:');
	console.log('1: Nueva compra <usuario_id, publicacion_id, cantidad>');
	console.log('2: Obtener Compras <server>');
	console.log('3: Estado Compra <server, num_compra>');
	console.log('4: Avanzar <server, num_compra, data>');
	console.log('5: Bajar Servidor <server>');
	console.log('6: Salir');
	console.log('******************************************************');
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

imprimirMenu();

process.stdin.on('data', (res) => {
	//console.log('Longitud Respuesta: ' + res.length);
	var cmd = res.trim().split(' ');
	var opc = cmd[0];
	//console.log('Respuesta: ' + opc);
	switch(opc){
	case '1':
		var data = {
			usuario_id : cmd[1],
			publicacion_id : cmd[2],
			cantidad : cmd[3]
		};
		console.log('Solicitando nueva compra: ' + data);
		socket.emit('nuevaCompra', data);
		break;
	case '2':
		var data = {
			server_name : cmd[1]
		};
		socket.emit('getCompras', data);
		break;
	case '3':
		var data = {
			server_name : cmd[1],
			num_compra : cmd[2]
		};
		socket.emit('getEstado', data);
		break;
	case '4':
		var data = '{"server_name": "'+ cmd[1]
					+'", "num_compra": "'+ cmd[2];
		if(cmd[3]){
			var atr = cmd[3].split('=');
			var key = atr[0].trim();
			var value = atr[1].trim();
			data = data + '", "'+ key + '": "' + value;
		}
		data = data + '"}';		
		socket.emit('avanzar', JSON.parse(data));
		break;
	case '5':
		var data = {
			server_name : cmd[1]
		};
		socket.emit('bajaServidor', data);
		break;
	case '6':
		console.log('Finalizando sesion del cliente del monitor');
		process.exit(0);
		break;
	default:
		console.log('La opcion seleccionada no existe.');
	}
	//process.stdin.pause();
	imprimirMenu();
});
