const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');

//Clase que simula el procesamiento de una solicitud al servidor "Infracciones"
//Tal vez seria mejor llamarlo "SolicitudInfracciones"
class Infraccion extends EventEmitter {
	constructor(refServer, id, data){
		super();

		this.server = refServer;
		this.infraccion_id = id;
		this.data = data;
		this.data.infraccion_id = id;
		this.estado = new Object();

		this.eventosPendientes = new Array();

		this.historial_eventos = new Array();

		//Eventos Externos
		this.on('compraGenerada', (data) => this.resolverInfraccion(data));
		
		//Eventos Internos
		//this.on('infraccionIniciada', (data) => this.resolverInfraccion(data));
		this.on('infraccionResuelta', (data) => this.informarResultado(data));
		this.on('resultadoInformado', (data) => this.finalizarVerificionInfraccion(data));
		
	}

	/* verificarCompra(data){
		//Estado actual: INICIANDO_INFRACCION
		this.estado.nombre = 'INICIANDO_INFRACCION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraGenerada';
		this.estado.transicion_out = ['infraccionIniciada']; //Se define mediante un arreglo porque pueden ser mas de una las transiciones de salida
		
		this.data = data;
		this.data.infraccion_id = this.infraccion_id;
				
		//sleep.sleep(2);
		
		//se registra nuevo evento en el historico
		this.historial_eventos.push({
			orden : 1,
			evento: this.estado.transicion_in 
		});
	} */

	resolverInfraccion(data){
		//Estado actual: RESOLVIENDO_INFRACCION
		this.estado = new Object();
		this.estado.nombre = 'RESOLVIENDO_INFRACCION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'infraccionIniciada';
		this.estado.transicion_out = ['infraccionResuelta'];

		//Se resuelve infraccion
		var result;
		if (!data.resultado_infraccion){
			result = Math.random() > 0.7 ? 'conInfraccion' : 'sinInfraccion';
		}else{
			result = data.resultado_infraccion;
		}
				
		this.data.resultado_infraccion = result;

		//sleep.sleep(2);

		this.historial_eventos.push({
			orden : 2,
			evento : this.estado.transicion_in 
		});
	}

	informarResultado(data){
		//Estado actual: INFORMANDO_RESULTADO
		this.estado = new Object();
		this.estado.nombre = 'INFORMANDO_RESULTADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'infraccionResuelta';
		this.estado.transicion_out = ['resultadoInformado'];

		//Se envia mensaje con resultado
		var topico = '.publicaciones.compras.';
		var mensaje = new Object();
		mensaje.evento = 'resultadoInfraccion';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.emit(this.estado.transicion_out[0]);
		//sleep.sleep(2);

		this.historial_eventos.push({
			orden : 3,
			evento : this.estado.transicion_in
		});
	}

	finalizarVerificionInfraccion(data){
		//Estado actual y final: INFRACCION_RESUELTA_INFORMADA
		this.estado = new Object();
		this.estado.nombre = 'INFRACCION_RESUELTA_INFORMADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'resultadoInformado';
		this.estado.transicion_out = null;

		//sleep.sleep(2);
		
		this.historial_eventos.push({
			orden : 4,
			evento : this.estado.transicion_in 
		});
	}
	
}

module.exports = Infraccion;
