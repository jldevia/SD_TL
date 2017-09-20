const EventEmitter = require('events').EventEmitter;
var amqp = require('amqplib');

'use strict';

class SesionWeb extends EventEmitter {
	constructor (sesion_id, usuario_id, modo){
		super();
		this.compra = new Object();
		this.sesion_id = sesion_id;
		this.modo = modo;
		this.compra.comprador = usuario_id;
		this.compra.estado = 'SESION_INICIADA';
		this.logEstado();
		
		//Se registran los eventos a escuchar
		this.on('iniciarCompra', (data) => this.iniciarCompra(data)); //solicitud del usuario (browser)
		this.on('nuevaCompra', () => this.informarNuevaCompra());
		this.on('compraGenerada', (data) => this.procesarCompraGenerada(data));
		this.on('entregaSeleccionada', (data) => this.procesarEntregaSeleccionada(data)); //solicitud del usuario (browser)
		this.on('informarEntregaSeleccionada', () => this.informarEntregaSeleccionada());
		this.on('importeCompraCalculado', (data) => this.procesarImporteCompra(data));
		this.on('pagoSeleccionado', (data) => this.procesarPagoSeleccionado(data)); //solicitud del usuario (browser)
		this.on('informarPagoSeleccionado', () => this.informarPagoSeleccionado());
		this.on('compraConcretada', () => this.informarCompraConcretada());
		this.on('pagoRechazado', () => this.informarPagoRechazado());

	}

	iniciarCompra (data){
		this.compra.publicacion_id = data.publicacion_id;
		this.compra.cantidad = data.cantidad;
		if ( this.modo === 'SIMULACION' ) {
			this.emit('nuevaCompra');
		}
	}

	informarNuevaCompra(){
		//Se publica mensaje "<nuevaCompra>" para servidor de compras
		var mensaje = new Object();
		var topico = '.compras.';
		mensaje.evento = 'nuevaCompra';
		mensaje.data = {
			publicacion_id : this.compra.publicacion_id,
			cantidad : this.compra.cantidad,
			comprador : this.compra.comprador,
			sesion_id : this.sesion_id
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
		this.compra.estado = 'COMPRA_INICIADA';
		this.logEstado();
	}

	procesarCompraGenerada(data){
		this.compra.num_compra = data.num_compra;
		this.compra.cantidad = data.cantidad;
		this.compra.estado = 'COMPRA_GENERADA';
		this.logEstado();

		//enviar como respuesta al browser el 'id' de la compra iniciada
		
		console.log('Enviando respuesta al usuario .. compra_id: ' + this.compra.num_compra, ' - publicacion_id: ' 
					+ this.compra.publicacion_id);
		
		if ( this.modo === 'SIMULACION' ) {
			var modo_entrega = Math.random() > 0.2 ? 'correo' : 'retira';
			var data2 = {
				forma_entrega : modo_entrega
			};
			this.emit('entregaSeleccionada', data2);
		}			
	}

	procesarEntregaSeleccionada (data){
		this.compra.formaEntrega = data.forma_entrega;

		if ( this.modo === 'SIMULACION' ) {
			this.emit('informarEntregaSeleccionada');
		}
		this.compra.estado = 'ENTREGA_SELECCIONADA';
		this.logEstado();
	}

	informarEntregaSeleccionada(){
		//Se publica mensaje <<entregaSeleccionada>> para el servidor de compras
		var topico = '.compras.';
		var mensaje = new Object();
		mensaje.evento = 'entregaSeleccionada';
		mensaje.data = {
			num_compra : this.compra.num_compra,
			sesion_id : this.sesion_id,
			forma_entrega: this.compra.forma_entrega
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	procesarImporteCompra(data){
		this.compra.subTotal = data.sub_total;
		this.compra.costoEnvio = data.costo_envio;
		this.compra.importeTotal = data.importe_total;

		//enviar como respuesta al browser el 'id' de la compra iniciada
		console.log('Enviando respuesta al usuario .. compra_id: ' + this.compra.compra_id
					+ ' - sub_total: '+ this.compra.subTotal + ' - costo_envio: '+ this.compra.costoEnvio+ ' - importe_total: '
						+ this.compra.importeTotal);
		
		this.compra.estado = 'IMPORTE_COMPRA_CALCULADO';
		this.logEstado();
		
		if ( modo === 'SIMULACION') {
			//Se simula la seleccion del medio de pago por parte del usuario
			var pago = Math.random() > 0.5 ? 'efectivo' : 'tarjeta';
			var data2 = {
				num_compra : this.compra.num_compra,
				sesion_id : this.sesion_id,
				medio_pago : pago,
				num_tarjeta : 'xxx-xxxxx-yyyyy'
			};
			this.emit('pagoSeleccionado', data2);
		}
	}

	procesarPagoEstablecido(data){
		this.compra.medioPago = data.medio_pago;
		this.compra.numTarjeta = data.num_tarjeta;
		this.compra.estado = 'PAGO_ESTABLECIDO';

		if ( this.modo === 'SIMULACION' ) {
			this.emit('informarPagoEstablecido');
		}
	}

	informarPagoSeleccionado(){
		//Se publica mensaje <<pagoEstablecido>> para el servidor de compras
		var topico = '.compras.';
		var mensaje = new Object();
		mensaje.evento = 'pagoSeleccionado';
		mensaje.data = {
			num_compra : this.compra.num_compra,
			sesion_id : this.sesion_id,
			medio_pago : this.compra.medioPago,
			num_tarjeta : this.compra.num_tarjeta	
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	informarCompraConcretada(){
		this.compra.estado = 'COMPRA_CONCRETADA';
		this.logEstado();
		//enviar como respuesta al browser el aviso de compra CONCRETADA
		console.log('Enviando respuesta al usuario ... compra_id: ' + this.compra.compra_id + ' CONCRETADA.');
	}

	informarPagoRechazado(){
		this.compra.estado = 'PAGO_RECHAZADO';
		this.logEstado();
		//enviar como respuesta al browser el aviso de PAGO RECHAZADO
		console.log('------------------------------------------');
		console.log('Enviando respuesta al usuario ... compra_id: ' + this.compra.compra_id + ' con PAGO RECHAZADO.');
		console.log('------------------------------------------');
	}

	logEstado(){
		console.log('------------------------------------------');
		console.log('Sesion: ' + this.sesion_id);
		console.log('N° Compra: ' + this.compra.num_compra);
		console.log('Estado: ' + this.compra.estado);
		console.log('------------------------------------------');
	}

	get estado (){
		return this.compra.estado;
	}
	
	publicarMensaje(topico, mensaje){
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log('------------------------------------------');
						console.log('Enviando Mensaje...');
						console.log('Topico: %s. Mensaje: ', topico, mensaje);
						console.log('------------------------------------------');
					})
					.catch(function(err){
						console.error('[SesionWeb]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[SesionWeb]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
	
}

module.exports = SesionWeb;