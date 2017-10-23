const { exec } = require('child_process');

var Util = function (){

	//Metodo para ejecutar procesos hijos 
	function ejecutarProceso(cmd){
		exec(cmd, { shell: true}, (err, stdout) => {
			if (err){
				console.error(`exec error: ${err}`);
			}else{
				console.log(`stdout: ${stdout}`);
			}
		});
	}

	//
	function startServers(modo) {
		startServer('envios_server', modo);
		startServer('infracciones_server', modo);
		startServer('pagos_server', modo);
		startServer('publicaciones_server', modo);
		startServer('compras_server', modo);
		startServer('web_server', modo);
	}

	function execSimulacion(){
		startServer('envios_server');
		startServer('infracciones_server');
		startServer('pagos_server');
		startServer('publicaciones_server');
		startServer('compras_server');
		ejecutarProceso('start cmd /K "cd ../web_server/ && node simulacion.js');
	}

	function startServer(server, modo){
		var comando = 'start cmd /K "cd ../' + server + '/ && node ' + server + ' ' + (modo || '')  + '"';
		ejecutarProceso(comando);
	}

	return {
		startServers : startServers,
		startServer : startServer,
		execSimulacion : execSimulacion,
		formatearMsg : function (msg){
			var cadena = '--------------------------\\n';
			cadena = cadena + msg;
			cadena = cadena + '\\n--------------------------\\n';

			return cadena;
		}
	};
}();

module.exports = Util;