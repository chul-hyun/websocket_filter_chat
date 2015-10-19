var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var _ = require('lodash');

var bodyParser = require('body-parser');

var profiles = {};
var rooms = {};

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('../public'));

app.post('/check_name', (req, res)=>{
	var socketID 	= req.body.socketID;
	var name 		= req.body.name;

	if(checkName(name, socketID)){
		profiles[socketID].name = name;
		res.end('succes');
	}else{
		res.end('fail');
	}
});

app.post('/update_proflie', (req, res)=>{
	var socketID 	= req.body.socketID;
	var data 		= req.body;

	if(checkName(data.name, socketID)){
		profiles[socketID] = _.assign(data, profiles[socketID]);
		res.end('succes');
	}else{
		res.end('fail');
	}
});

app.post('/add_room', (req, res)=>{
	var socketID 	= req.body.socketID;
	var title 		= req.body.title;
	var filter 		= req.body.filter;

	var profile 	= profiles[socketID];

	console.log(profile);
	if(filter.gender !== 'any' && filter.gender !== profile.gender){
		res.json({
			state 	: 'fail',
			data 	: '성별을 확인해주세요.'
		});
		return;
	}

	rooms[socketID] = {
		title 	: title,
		filter 	: filter,
		roomKey : socketID,
		userKeys: [],
		users 	: []
	}

	res.json({
		state 	: 'succes',
		data 	: socketID
	});
});

app.get('/search_room', (req, res)=>{
	var socketID 	= req.param('socketID');
	var filter 		= req.param('filter');


	var filterData = _.filter(rooms, function(room) {
		if(filter.gender !== 'any' && filter.gender !== room.filter.gender){
			return false;
		}

		if(filter.peopleLimtNumber > 0 && 
			parseInt(filter.peopleLimtNumber) < parseInt(room.filter.peopleLimtNumber)){
			return false;
		}

		return true;
	});

	res.json(filterData);
});

io.on('connection', (socket)=>{
	profiles[socket.id] = {};
	socket.emit('socket id', socket.id);

	socket.on('disconnect', ()=>{
		leaveRoom(profiles, rooms, socket);
		delete profiles[socket.id];
	});

	socket.on('join room', (roomKey)=>{
		joinRoom(socket, roomKey)
	});

	socket.on('send message', (message)=>{
		var profile = profiles[socket.id];
		io.to(profile.currentRoomKey).emit('receive message', profile.name + ' : ' +message);
	});

	socket.on('leave room', ()=>{
		leaveRoom(profiles, rooms, socket);
	});

});

http.listen(3000, function(){
	console.log('listening on *:3000');
});





function emitChangeRoom(roomKey, room, socket){
	socket.emit('change room list');
	socket.broadcast.emit('change room list');
	io.to(roomKey).emit('chnage room info', room);
}

function joinRoom(socket, roomKey){
	var room  	= rooms[roomKey];
	var profile = profiles[socket.id];

	if(room.users.length >= room.filter.peopleLimtNumber){
		socket.emit('join room fail', '제한인원 초과');
		return false;
	}

	if(room.filter.gender !== 'any' && profile.gender !== room.filter.gender){
		console.log(socket.id);
		socket.emit('join room fail', '필터 통과 실패');
		return false;
	}

	leaveRoom(profiles, rooms, socket);

	room.userKeys.push(socket.id);
	room.users.push(profile.name);
	
	profile.currentRoomKey = roomKey;
	socket.join(roomKey);
	
	socket.emit('join room succes', room);

	emitChangeRoom(roomKey, room, socket);
}

function leaveRoom(profiles, rooms, socket){
	var profile = profiles[socket.id];
	var roomKey = profile.currentRoomKey;
	var room = rooms[roomKey];

	if(roomKey === undefined){
		return;
	}

	_.pull(room.userKeys, socket.id);
	_.pull(room.users, profile.name);
	socket.leave(roomKey)

	socket.emit('leave room');
	emitChangeRoom(roomKey, room, socket);

	delete profile.currentRoomKey;
}

function checkName(name, socketID){
	var findSocketID = _.findKey(profiles, {name: name});
	return findSocketID === undefined || findSocketID === socketID;
}
