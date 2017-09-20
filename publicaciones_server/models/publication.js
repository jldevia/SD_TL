var mongoose = require ('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/publicaciones_db', {
	useMongoClient : true
});

var schPublication = new Schema({
	numero : Number,
	desde: Date,
	hasta: Date,
	cant_ofertada: Number,
	inventario : {
		numero: Number,
		stock: Number,
		stock_reservado : Number,
		stock_envio : Number,
		num_almacen: Number,
		fecha_update: Date,
		producto : {
			codigo: String,
			num_serie: String,
			nombre: String,
			especificaciones: String,
			precio: Number
		}
	},
	vendedor : {
		id: Number,
		num_doc: String,
		nombre: String,
		apellido: String,
		username: String,
		password: String,
		email: String,
		num_telefono : String,
		rol: {
			nombre: String,
			desde: Date,
			hasta: Date
		}
	}
});

schPublication.statics.reservarProducto = function(publi_id, cant, cb) {
	this.findOne({numero : publi_id}, function(err, publication){
		if (err){
			cb(err);
		}else{
			if (publication) {
				//Se le resta al stock la cantidad que se solicita "reservar"
				var stock_actual = publication.inventario.stock;
				publication.inventario.stock = stock_actual - cant;

				//Se le suma al stock_reservado la cantidad que se solicita "reservar"
				var stock_reservado_actual = publication.inventario.stock_reservado;
				publication.inventario.stock_reservado = stock_reservado_actual + cant;

				//se actualiza la fecha de actualizacion del registro
				publication.inventario.fecha_update = new Date();

				publication.save(function(err, updatedPublic){
					if (err) {
						cb(err);
					}else{
						cb(null, updatedPublic);
					}
				});
			}
			
		}
		
	});
};	

schPublication.statics.liberarProducto = function(publi_id, cant, cb){
	this.findOne({numero: publi_id}, function(err, publication){
		if (err){
			cb(err);
		}else{
			if (publication){
				//Se le resta al stock_reservado la cantidad que se solicita "liberar"
				var stock_reservado_actual = publication.inventario.stock_reservado;
				publication.inventario.stock_reservado = stock_reservado_actual - cant;

				//Se le suma al stock la cantidad que se solicita "liberar"
				var stock_actual = publication.inventario.stock;
				publication.inventario.stock = stock_actual + cant;

				//se actualiza la fecha de actualizacion del registro
				publication.inventario.fecha_update = new Date();

				publication.save(function(err, updatedPublic){
					if (err) {
						cb(err);
					}else{
						cb(null, updatedPublic);
					}
				});
			}
		}
	});
};

schPublication.statics.enviarProducto = function(publi_id, cant, cb){
	this.findOne({numero: publi_id}, function(err, publication){
		if (err){
			cb(err);
		}else{
			if (publication) {
				//Se le resta al stock_reservado la cantidad que se solicita "enviar"
				var stock_reservado_actual = publication.inventario.stock_reservado;
				publication.inventario.stock_reservado = stock_reservado_actual - cant;

				//Se le suma al stock_envio la cantidad que se solicita "enviar"
				var stock_actual_envio = publication.inventario.stock_envio;
				publication.inventario.stock_envio = stock_actual_envio + cant;

				//se actualiza la fecha de actualizacion del registro
				publication.inventario.fecha_update = new Date();

				publication.save(function(err, updatedPublic){
					if (err) {
						cb(err);
					}else{
						cb(null, updatedPublic);
					}
				});
			}
		}
		
	});
};

schPublication.statics.runSeeder = function(){
	// Creando Publicacion 1
	this.create({
		numero : 1,
		desde: new Date(2017, 8, 25),
		hasta: new Date(2017, 9, 30),
		cant_ofertada: 10,
		inventario : {
			numero: 100,
			stock: 25,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 5,
			fecha_update: new Date(2017, 8, 25),
			producto : {
				codigo: 'prod01',
				num_serie: '20687/024',
				nombre: 'Sarten Doble Tramontina',
				especificaciones: 'Sartén 2 en 1. Juntos o separados. Sistema de encastre. Diametro 24 cm',
				precio: 548
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 2
	this.create({
		numero : 2,
		desde: new Date(2017, 7, 2),
		hasta: new Date(2017, 10, 2),
		cant_ofertada: 5,
		inventario : {
			numero: 110,
			stock: 10,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 6,
			fecha_update: new Date(2017, 7, 2),
			producto : {
				codigo: 'prod02',
				num_serie: 'IAM:220',
				nombre: 'Colchón Sommier Simmons Beautyrest Intelligent',
				especificaciones: 'Plazas: 2 1/2 Plazas. Resortes: Beautyrest. Medida: 190x150',
				precio: 56548
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 3
	this.create({
		numero : 3,
		desde: new Date(2017, 8, 20),
		hasta: new Date(2017, 11, 15),
		cant_ofertada: 6,
		inventario : {
			numero: 250,
			stock: 12,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 10,
			fecha_update: new Date(2017, 8, 20),
			producto : {
				codigo: 'prod03',
				num_serie: 'AS00001',
				nombre: 'Pendrive Sandisk Cruzer Dial 32gb',
				especificaciones: 'Capacidad: 32GB. USB 2.0. Retractil',
				precio: 425
			}
		},
		vendedor : {
			id: 10,
			num_doc: '28.111.625',
			nombre: 'Candelaria Agustina',
			apellido: 'Perez',
			username: '',
			password: '',
			email: 'vendedor2@sd_ecommerce.com',
			num_telefono : '11-56892256',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2016, 10, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 4
	this.create({
		numero : 4,
		desde: new Date(2017, 9, 2),
		hasta: new Date(2017, 11, 25),
		cant_ofertada: 8,
		inventario : {
			numero: 252,
			stock: 15,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 10,
			fecha_update: new Date(2017, 8, 20),
			producto : {
				codigo: 'prod04',
				num_serie: 'CPU-001',
				nombre: 'Computadora Intel Dual Core',
				especificaciones: 'Dual Core Intel J1800. HDD WD 500GB. 4 GB RAM',
				precio: 4999
			}
		},
		vendedor : {
			id: 10,
			num_doc: '28.111.625',
			nombre: 'Candelaria Agustina',
			apellido: 'Perez',
			username: '',
			password: '',
			email: 'vendedor2@sd_ecommerce.com',
			num_telefono : '11-56892256',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2016, 10, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 5
	this.create({
		numero : 5,
		desde: new Date(2017, 9, 10),
		hasta: new Date(2017, 12, 5),
		cant_ofertada: 6,
		inventario : {
			numero: 254,
			stock: 20,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 10,
			fecha_update: new Date(2017, 9, 20),
			producto : {
				codigo: 'prod05',
				num_serie: 'WD2003FZEX',
				nombre: 'Disco Rígido Western Digital Caviar Black 2tb',
				especificaciones: '2 TB. Velocidad de rotación 7.2 rpm',
				precio: 2990
			}
		},
		vendedor : {
			id: 10,
			num_doc: '28.111.625',
			nombre: 'Candelaria Agustina',
			apellido: 'Perez',
			username: '',
			password: '',
			email: 'vendedor2@sd_ecommerce.com',
			num_telefono : '11-56892256',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2016, 10, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 6
	this.create({
		numero : 6,
		desde: new Date(2017, 7, 20),
		hasta: new Date(2017, 11, 15),
		cant_ofertada: 9,
		inventario : {
			numero: 275,
			stock: 18,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 10,
			fecha_update: new Date(2017, 7, 20),
			producto : {
				codigo: 'prod06',
				num_serie: 'UPS-001',
				nombre: 'Ups P/tv, Informatica Bx550ci 3 Tomas',
				especificaciones: 'Sin especificaciones',
				precio: 1999
			}
		},
		vendedor : {
			id: 10,
			num_doc: '28.111.625',
			nombre: 'Candelaria Agustina',
			apellido: 'Perez',
			username: '',
			password: '',
			email: 'vendedor2@sd_ecommerce.com',
			num_telefono : '11-56892256',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2016, 10, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 7
	this.create({
		numero : 7,
		desde: new Date(2017, 8, 10),
		hasta: new Date(2017, 11, 15),
		cant_ofertada: 10,
		inventario : {
			numero: 280,
			stock: 25,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 12,
			fecha_update: new Date(2017, 9, 15),
			producto : {
				codigo: 'prod07',
				num_serie: 'VEM-244',
				nombre: 'Celular Libre Hyundai Ultra Storm Plata',
				especificaciones: 'pantalla curva tipo IPS de 5.5.  procesador Octa Core 1.3 Ghz.  RAM de 3GB',
				precio: 6999
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 8
	this.create({
		numero : 8,
		desde: new Date(2017, 9, 1),
		hasta: new Date(2017, 12, 15),
		cant_ofertada: 10,
		inventario : {
			numero: 282,
			stock: 25,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 12,
			fecha_update: new Date(2017, 9, 14),
			producto : {
				codigo: 'prod08',
				num_serie: 'H870',
				nombre: 'Celular Lg G6 H870 32gb 4gb Ram 4g 13mpx',
				especificaciones: 'Pantalla Fullvision QHD de 14 cm (5.7")',
				precio: 13799
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 9
	this.create({
		numero : 9,
		desde: new Date(2017, 9, 1),
		hasta: new Date(2017, 12, 15),
		cant_ofertada: 10,
		inventario : {
			numero: 283,
			stock: 22,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 12,
			fecha_update: new Date(2017, 9, 8),
			producto : {
				codigo: 'prod09',
				num_serie: 'MaxLGx145',
				nombre: 'Celular Lg X Max 4g Lte 5.5 Hd',
				especificaciones: '16gb 13mp Libre',
				precio: 4190
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});

	// Creando Publicacion 10
	this.create({
		numero : 10,
		desde: new Date(2017, 9, 10),
		hasta: new Date(2017, 10, 5),
		cant_ofertada: 7,
		inventario : {
			numero: 286,
			stock: 17,
			stock_reservado : 0,
			stock_envio : 0,
			num_almacen: 12,
			fecha_update: new Date(2017, 9, 15),
			producto : {
				codigo: 'prod10',
				num_serie: 'S8+',
				nombre: 'Celular Samsung S8 Plus',
				especificaciones: '64gb-4k-4g Lte- Android',
				precio: 19300
			}
		},
		vendedor : {
			id: 10,
			num_doc: '8.025.369',
			nombre: 'Jorge Ruben',
			apellido: 'Gonzalez',
			username: '',
			password: '',
			email: 'vendedor1@sd_ecommerce.com',
			num_telefono : '11-585633369',
			rol: {
				nombre: 'VENDEDOR',
				desde: new Date(2015, 12, 15),
				hasta: new Date(2019, 12, 14)
			}
		}
	}, function(err, objCreated){
		if(err){
			console.error('[Publicaciones_server]: Error creando publicacion: ' + err);
		}else if (objCreated){
			console.log('[Publicaciones_server]: Publicacion creada: ' + objCreated);
		}
	});
};

var Publication = mongoose.model('Publication', schPublication);

module.exports = Publication;