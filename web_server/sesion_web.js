const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');

'use strict';

class SesionWeb extends EventEmitter {
	constructor (refServer, sesion_id, usuario_id){
		super();

		this.estado = new Object();
		this.sesion_id = sesion_id;
		this.usuario_id = usuario_id;
		this.orden_evento = 0;
		this.server = refServer;
		
		this.eventosPendientes = new Array();
		this.historial_eventos = new Array();
		
		//Eventos externos
		this.on('iniciarCompra', (data) => this.iniciarCompra(data)); //solicitud del usuario (browser)
		this.on('compraGenerada', (data) => this.procesarCompraGenerada(data));
		this.on('entregaSeleccionada', (data) => this.procesarEntregaSeleccionada(data)); //solicitud del usuario (browser)
		this.on('importeCompraCalculado', (data) => this.procesarImporteCompra(data));
		this.on('pagoSeleccionado', (data) => this.procesarPagoSeleccionado(data)); //solicitud del usuario (browser)
		this.on('confirmarCompra', (data) => this.solicitarConfirmacionCompra(data));
		this.on('compraRechazadaPorInfraccion', (data) => this.informarCompraRechazada(data));
		this.on('compraConcretada', (data) => this.informarCompraConcretada(data));
		this.on('pagoRechazado', (data) => this.informarPagoRechazado(data));

		//Eventos internos
		this.on('nuevaCompraIniciada', (data) => this.informarNuevaCompra(data));
		this.on('entregaSeleccionadaProcesada', (data) => this.informarEntregaSeleccionada(data));
		this.on('pagoSeleccionadoProcesado', (data) => this.informarPagoSeleccionado(data));
		this.on('compraConfirmada', (data)  => this.procesarConfirmacionCompra(data));
		this.on('estadoFinal', (estado, origen) => this.establecerEstadoFinal(estado, origen));
				
	}

	iniciarCompra (data){
		//Estado actual: INICIANDO_COMPRA
		this.estado.nombre = 'INICIANDO_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'iniciarCompra';
		this.estado.transicion_out = ['nuevaCompraIniciada'];
		
		
		//Actualizando data
		this.data = data;
		this.data.sesion_id = this.sesion_id;
		this.data.num_compra = this.sesion_id; //Se asigna la sesion_id como num_compra
		this.data.comprador_id = this.usuario_id;
		
		//sleep.sleep(3);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
		
		this.logEstado();
	}

	informarNuevaCompra(data){
		//Estado actual: INFORMANDO_NUEVA_COMPRA
		this.estado.nombre = 'INFORMANDO_NUEVA_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'nuevaCompraIniciada';
		this.estado.transicion_out = [];
		
		
		//Se publica mensaje "<nuevaCompra>" para servidor de compras
		var mensaje = new Object();
		var topico = '.compras.';
		mensaje.evento = 'nuevaCompra';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});		
		
	}

	procesarCompraGenerada(data){
		//Estado actual: PROCESANDO_COMPRA_GENERADA
		this.estado.nombre = 'PROCESANDO_COMPRA_GENERADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraGenerada';
		this.estado.transicion_out = ['entregaSeleccionada'];
		
		//Se actualiza data
		this.data = data;		

		//enviar como respuesta al browser el 'id' de la compra iniciada
		console.log('[Web_server] - Nueva Compra generada N°: ' + this.data.num_compra);
		this.server.logMonitor('[Web_server] - Nueva Compra generada N°: ' + this.data.num_compra);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

		sleep.sleep(3);
						
	}

	procesarEntregaSeleccionada (data){
		//Estado actual: PROCESANDO_ENTREGA_SELECCIONADA
		this.estado.nombre = 'PROCESANDO_ENTREGA_SELECCIONADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'entregaSeleccionada';
		this.estado.transicion_out = ['entregaSeleccionadaProcesada'];
				
		//Se actualiza data
		var entrega;
		if (!data.forma_entrega) {
			entrega = Math.random() > 0.2 ? 'correo' : 'retira';
		}else{
			entrega = data.forma_entrega;
		}
		this.data.forma_entrega = entrega;

		sleep.sleep(3);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	informarEntregaSeleccionada(data){
		//Estado actual: INFORMANDO_ENTREGA_SELECCIONADA
		this.estado.nombre = 'INFORMANDO_ENTREGA_SELECCIONADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'entregaSeleccionadaProcesada';
		this.estado.transicion_out = [];
		
		//Se publica mensaje <<entregaSeleccionada>> para el servidor de compras
		var topico = '.compras.';
		var mensaje = new Object();
		mensaje.evento = 'entregaSeleccionada';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	procesarImporteCompra(data){
		//Estado actual: PROCESANDO_IMPORTE_COMPRA
		this.estado.nombre = 'PROCESANDO_IMPORTE_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'importeCompraCalculado';
		this.estado.transicion_out = ['pagoSeleccionado'];
		
		//Actualizando data
		this.data = data;

		//enviar como respuesta al browser el 'id' de la compra iniciada
		console.log('Enviando respuesta al usuario .. compra_id: ' + this.data.num_compra
					+ ' - sub_total: '+ this.data.sub_total + ' - costo_envio: '+ this.data.costo_envio + ' - importe_total: '
						+ this.data.importe_total);
		
		this.server.logMonitor('Enviando respuesta al usuario .. compra_id: ' + this.data.num_compra
								+ ' - sub_total: '+ this.data.sub_total + ' - costo_envio: '+ this.data.costo_envio + ' - importe_total: '
									+ this.data.importe_total);						
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	procesarPagoSeleccionado(data){
		//Estado actual: PROCESANDO_PAGO_SELECCIONADO
		this.estado.nombre = 'PROCESANDO_PAGO_SELECCIONADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'pagoSeleccionado';
		this.estado.transicion_out = ['pagoSeleccionadoProcesado'];
		
		//Se actualiza data
		var medio;
		if ( !data.medio_pago) {
			medio = Math.random() > 0.5 ? 'efectivo' : 'tarjeta';
		}else {
			medio = data.medio_pago;
		}

		this.data.medio_pago = medio;

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
		
	}

	informarPagoSeleccionado(){
		//Estado actual: INFORMANDO_PAGO_SELECCIONADO
		this.estado.nombre = 'INFORMANDO_PAGO_SELECCIONADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'pagoSeleccionadoProcesado';
		this.estado.transicion_out = [];

		//Se publica mensaje <<pagoEstablecido>> para el servidor de compras
		var topico = '.compras.';
		var mensaje = new Object();
		mensaje.evento = 'pagoSeleccionado';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	solicitarConfirmacionCompra(data){
		//Estado actual: SOLICITANDO_CONFIRMACION_COMPRA
		this.estado.nombre = 'SOLICITANDO_CONFIRMACION_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'confirmarCompra';
		this.estado.transicion_out = ['compraConfirmada'];

		console.log('Confirmacion compra N° '+ this.data.num_compra);
		console.log('Confirmacion (aceptada/cancelada): ');
		var msg = 'Confirmacion compra N° ' + this.data.num_compra + '\n';
		msg = msg + 'Confirmacion (aceptada/cancelada): ';
		this.server.logMonitor(msg);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	procesarConfirmacionCompra(data){
		//Estado actual: PROCESANDO_CONFIRMACION_COMPRA
		this.estado.nombre = 'PROCESANDO_CONFIRMACION_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraConfirmada';
		this.estado.transicion_out = [];

		//Se actualiza data
		var respuesta;
		if (!data.confirmacion){
			respuesta = Math.random() > 0.2 ? 'aceptada' : 'cancelada';
		}else{
			respuesta = data.confirmacion;
		}
		this.data.confirmacion = respuesta;

		//Se envia mensaje con la confirmacion al Server Compras
		var topico = '.compras.';
		var msg = new Object();
		msg.evento = 'confirmacionCompra';
		msg.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(msg));

		if (this.data.confirmacion === 'cancelada') {
			//Se establece estado de la sesion en "COMPRA_CANCELADA"
			this.emit('estadoFinal', 'COMPRA_CANCELADA', 'compraConfirmada');
		}

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	informarCompraRechazada(data){
		//Estado actual: INFORMANDO_COMPRA_RECHAZADA
		this.estado.nombre = 'INFORMANDO_COMPRA_RECHAZADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraRechazadaPorInfraccion';
		this.estado.transicion_out = [];

		//enviar como respuesta al browser el aviso de compra CONCRETADA
		console.log('La compra N° ' + this.data.num_compra + 
					' ha sido rechazada por una Infraccion');

		this.server.logMonitor('La compra N° ' + this.data.num_compra + 
								' ha sido rechazada por una Infraccion');			

		sleep.sleep(3);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

		//Se pasa automaticamente al estado final de la sesion
		this.emit('estadoFinal', 'COMPRA_RECHAZADA', 'compraRechazadaPorInfraccion');

	}

	informarCompraConcretada(){
		//Estado actual: INFORMANDO_COMPRA_CONCRETADA
		this.estado.nombre = 'INFORMANDO_COMPRA_CONCRETADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraConcretada';
		this.estado.transicion_out = [];

		//enviar como respuesta al browser el aviso de compra CONCRETADA
		console.log('La compra N° ' + this.data.num_compra + 
					' ha sido finalizada de forma exitosa. Felicitaciones por su nueva compra!!!');

		this.server.logMonitor('La compra N° ' + this.data.num_compra + 
								' ha sido finalizada de forma exitosa. Felicitaciones por su nueva compra!!!');			
		
		sleep.sleep(3);

		this.historial_eventos.push({
		
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

		//Se pasa automaticamente al estado final de la sesion
		this.emit('estadoFinal', 'COMPRA_CONCRETADA', 'compraConcretada');
	}

	informarPagoRechazado(){
		//Estado actual: INFORMANDO_COMPRA_CONCRETADA
		this.estado.nombre = 'INFORMANDO_PAGO_RECHAZADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'pagoRechazado';
		this.estado.transicion_out = [];

		//Se informa al usuario sobre el rechazo del pago 
		console.log('El pago de la compra N° ' + this.data.num_compra + ' ha sido rechazado. Compra cancelada por el sitio');
		this.server.logMonitor('El pago de la compra N° ' + this.data.num_compra + ' ha sido rechazado. Compra cancelada por el sitio');
		
		sleep.sleep(3);
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

		//Se pasa automaticamente al estado final de la sesion
		this.emit('estadoFinal', 'PAGO_RECHAZADO', 'pagoRechazado');
	}

	establecerEstadoFinal(newEstado, origen){
		//Estado actual: INFORMANDO_COMPRA_CONCRETADA
		this.estado.nombre = newEstado;
		this.estado.timestamp = new Date();
		this.estado.transicion_in = origen;
		this.estado.transicion_out = [];

		this.logEstado();

	}

	logEstado(){
		var msg = 'Sesion: ' + this.data.sesion_id;
		msg = msg + '\nN° Compra: ' + this.data.num_compra;
		msg = msg + '\nEstado: ' + this.estado.nombre;
		
		console.log('------------------------------------------');
		console.log(msg);
		console.log('------------------------------------------');
		this.server.logMonitor(msg);

	}

}

module.exports = SesionWeb;