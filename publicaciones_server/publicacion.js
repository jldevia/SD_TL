const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');
var PublicationModel = require('./models/publication');

//Clase que simula el procesamiento de una solicitud al servidor "Publicaciones"
//Tal vez seria mejor llamarlo "SolicitudPublicacion"
class Publicacion extends EventEmitter{
	constructor(refServer, id, data){
		super();

		this.id = id;
		this.estado = new Object();
		this.server = refServer;
		this.data = data;
		this.data.req_publicacion_id = id;

		this.eventosPendientes = new Array();
		
		//Eventos externos
		this.on('compraGenerada', (data) => this.reservarProducto(data));
		this.on('resultadoInfraccion', (data) => this.procesarResultadoInfraccion(data));
		this.on('autorizacionPago', (data) => this.procesarAutorizacionPago(data));
		this.on('enviarProducto', (data) => this.procesarEnvioProducto(data));
		
		//Eventos internos
		//this.on('solicitudIniciada', (data) => this.reservarProducto(data));
		this.on('productoReservado', (data) => this.esperar(data, 'productoReservado'));
		this.on('resultadoInfraccionProcesado', (data) => this.esperar(data, 'resultadoInfraccionProcesado'));
		this.on('autorizacionPagoProcesado', (data) => this.esperar(data, 'autorizacionPagoProcesado'));
		this.on('envioProductoProcesado', (data) => this.finalizarSolicitud(data));
		
	}

	// iniciarSolicitud(data){
	// 	//Estado actual: INICIANDO_SOLICITUD
	// 	this.estado.nombre = 'INICIANDO_SOLICITUD';
	// 	this.estado.timestamp = new Date();
	// 	this.estado.transicion_in = 'compraGenerada';
	// 	this.estado.transicion_out = ['solicitudIniciada']; //Se define mediante un arreglo porque pueden ser mas de una las transiciones de salida

	// 	//Se actualiza la data
	// 	this.data = data;
	// 	this.data.req_publicacion_id = this.id;

	// 	//sleep.sleep(2);

	// 	//se registra nuevo evento en el historico
	// 	this.historial_eventos.push({
	// 		orden : this.orden_eventos++,
	// 		evento: this.estado.transicion_in 
	// 	});
	// }

	reservarProducto(data){
		//Estado actual: RESERVANDO_PRODUCTO
		var obj = this;
		this.estado.nombre = 'RESERVANDO_PRODUCTO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'solicitudIniciada';
		this.estado.transicion_out = ['productoReservado'];

		//Se reserva el producto
		PublicationModel.reservarProducto(this.data.publicacion_id, this.data.cantidad, function(err, publi){
			if (err) {
				console.error('[Publicaciones_server]: Error al reservar producto: '+ err);
				obj.server.logMonitor('[Publicaciones_server]: Error al reservar producto: '+ err);
			}else{
				console.log('[Publicaciones_server]: Producto reservado: ' + publi);
				obj.server.logMonitor('[Publicaciones_server]: Producto reservado: ' + publi);
			}
		});

	}

	esperar(data, origen){
		//Estado actual: ESPERANDO
		this.estado.nombre = 'ESPERANDO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = origen;
		this.estado.transicion_out = [];

		sleep.sleep(2);
	
	}

	procesarResultadoInfraccion(data){
		//Estado actual: PROCESANDO_RESULTADO_INFRACCION
		var obj = this;
		this.estado.nombre = 'PROCESANDO_RESULTADO_INFRACCION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'resultadoInfraccion';
		this.estado.transicion_out = ['resultadoInfraccionProcesado'];

		//Se actualiza data
		this.data = data;

		if ( data.resultado === 'conInfraccion' ){
			PublicationModel.liberarProducto(data.publicacion_id, data.cantidad, function(err, publi){
				if (err) {
					console.error('[Publicaciones_server]: Error al liberar producto: '+ err);
					obj.server.logMonitor('[Publicaciones_server]: Error al liberar producto: '+ err);
				}else{
					console.log('[Publicaciones_server]: Producto liberado: ' + publi);
					obj.server.logMonitor('[Publicaciones_server]: Producto liberado: ' + publi);
				}
			});
		}
	}

	procesarAutorizacionPago(data){
		//Estado actual: PROCESANDO_AUTORIZACION_PAGO
		var obj = this;
		this.estado.nombre = 'PROCESANDO_AUTORIZACION_PAGO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'autorizacionPago';
		this.estado.transicion_out = ['autorizacionPagoProcesado'];

		//Se actualiza data
		this.data = data;
		if ( data.rechazado === 'V' ){
			PublicationModel.liberarProducto(data.publicacion_id, data.cantidad, function(err, publi){
				if (err) {
					console.error('[Publicaciones_server]: Error al liberar producto: '+ err);
					obj.server.logMonitor('[Publicaciones_server]: Error al liberar producto: '+ err);
				}else{
					console.log('[Publicaciones_server]: Producto liberado: ' + publi);
					obj.server.logMonitor('[Publicaciones_server]: Producto liberado: ' + publi);
				}
			});
		}

	}

	procesarEnvioProducto(data){
		//Estado actual: PROCESANDO_ENVIO_PRODUCTO
		var obj = this;
		this.estado.nombre = 'PROCESANDO_ENVIO_PRODUCTO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'enviarProducto';
		this.estado.transicion_out = ['envioProductoProcesado'];

		//Se actualiza data
		this.data = data;

		PublicationModel.enviarProducto(data.publicacion_id, data.cantidad, function(err, publi){
			if (err) {
				console.error('[Publicaciones_server]: Error al enviar producto: '+ err);
				obj.server.logMonitor('[Publicaciones_server]: Error al enviar producto: '+ err);
			}else{
				console.log('[Publicaciones_server]: Producto enviado: ' + publi);
				obj.server.logMonitor('[Publicaciones_server]: Producto enviado: ' + publi);
			}
		});

		this.emit(this.estado.transicion_out[0]);

	}

	finalizarSolicitud(data){
		//Estado actual: SOLICITUD_FINALIZADA
		this.estado.nombre = 'SOLICITUD_FINALIZADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'envioProductoProcesado';
		this.estado.transicion_out = [];
				
	}
}// fin de la clase

module.exports = Publicacion;