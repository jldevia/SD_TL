const { exec } = require('child_process');

var simulacion = function (){
	ejecutarProceso('start cmd /K "cd ../infracciones_server/ && node infracciones_server.js"');
	ejecutarProceso('start cmd /K "cd ../pagos_server/ && node pagos_server.js"');
	ejecutarProceso('start cmd /K "cd ../envios_server/ && node envios_server.js"');
	ejecutarProceso('start cmd /K "cd ../publicaciones_server/ && node publicaciones_server.js"');
	ejecutarProceso('start cmd /K "cd ../compras_server/ && node compras_server.js"');
	ejecutarProceso('start cmd /K "cd ../web_server/ && node simulador_compras.js"');
	
	function ejecutarProceso(cmd){
		exec(cmd, {shell : true}, (err, stdout, stderr) =>{
			if (err){
				console.error(`exec error: ${err}`);
			}else{
				console.log(`stdout: ${stdout}`);
				console.log(`stderr: ${stderr}`);
			}	
		});
	}
};

module.exports = simulacion;
