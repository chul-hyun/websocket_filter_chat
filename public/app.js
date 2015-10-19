
var socket = io();

jQuery(function($){
	socket.on('socket id', function(socketID){
		app($, socketID);
	});
});

function app($, socketID){

	profileCtrl($, socketID);
	roomCtrl($, socketID);
	chatCtrl($, socketID);
}

function profileCtrl($, socketID){
	var connectOrder = 0;

	var $name 			= $('#name');
	var $gender 		= $('#gender');
	var $profileDone 	= $('#profile_done');

	var passedName 		= false;
	var passedGender 	= false;

	checkName();
	checkGender();

	$name.on('keyup', checkName);
	$gender.on('change', checkGender);
	$profileDone.on('click', addProfile);


	function checkName(){
		var name = $.trim($name.val());

		if('' === name){
			passedName = false;
			applyView();
			return;
		}

		connectOrder++;
		$.post('/check_name', {
			name 	: name,
			socketID: socketID
		}).done(getCheckNameView(connectOrder));

		function getCheckNameView(connectedOrder){
			return function res(result){
				if(connectedOrder !== connectOrder){
					return;
				}

				if(result === 'succes'){
					passedName = true;
				}else{
					passedName = false;
				}
				applyView();
			}
		}
	}

	function checkGender(){
		var gender = $.trim($gender.val());

		if('man' === gender || 'woman' === gender){
			passedGender = true;
		}else{
			passedGender = false;
		}
		
		applyView();
	}

	function applyView(){
		if(passedName){
			$name.addClass('succes').removeClass('fail');
		}else{
			$name.addClass('fail').removeClass('succes');
		}

		if(passedGender){
			$gender.addClass('succes').removeClass('fail');
		}else{
			$gender.addClass('fail').removeClass('succes');
		}

		if(!passedName || !passedGender){
			$profileDone.prop('disabled', true);
		}else{
			$profileDone.prop('disabled', false);
		}
	}

	function addProfile(){
		var name = $.trim($name.val());
		var gender = $gender.val();

		$.post('/update_proflie',{
			socketID: socketID,
			name: name,
			gender: gender
		}).done((result)=>{
			if(result === 'succes'){
				$profileDone
					.add($name)
					.add($gender)
					.prop('disabled', true);
			}else{
				checkName();
				checkGender();
			}
		});
	}

	function isInt(n) {
		return n % 1 === 0;
	}
}

function roomCtrl($, socketID){
	var $search 			= $('#search');
	var $filterGender 		= $('#filter_gender');
	var $peopleLimtNumber 	= $('#people_limt_number');
	var $roomList 			= $('#room_list');
	var $addRoom 			= $('#add_room');
	var $roomTitle 			= $('#room_title');
	var $users 				= $('#users');
	var $leaveRoom 	= $('#leave_room');

	var $joiner 			= $('#joiner');
	var $filterInfo 		= $('#filter_info');
	var $joinRoomTitle 		= $('#join_room_title');

	var searchedInfo; 
	
	$search.on('click', (e)=>{
		var filterGender 		= $filterGender.val();
		var peopleLimtNumber 	= $peopleLimtNumber.val();

		var searchInfo = {
			socketID 	: socketID,
			filter 		: {
				gender 				: filterGender,
				peopleLimtNumber 	: peopleLimtNumber
			}
		};

		searchedInfo = searchInfo;

		$.get('/search_room', searchInfo).done(updateRoomList);
	});

	socket.on('change room list', function(){
		console.log('ttt');
		if($.isPlainObject(searchedInfo)){
			$.get('/search_room', searchedInfo).done(updateRoomList);
		}
	})

	$roomList.on('click', '.room', function(){
		var roomKey = $(this).attr('id');
		joinRoom(roomKey);
	});
	$leaveRoom.on('click', leaveRoom);

	socket.on('join room fail', function(message){
		alert(message);
	});

	socket.on('join room succes', updateRoom);
	socket.on('chnage room info', updateRoom);

	$addRoom.on('click', function(){
		var roomTitle  			= $.trim($roomTitle.val());
		var filterGender 		= $filterGender.val();
		var peopleLimtNumber 	= $peopleLimtNumber.val();

		if(roomTitle === ''){
			alert('방 제목을 입력해주세요.');
			return;
		}

		var addRoomInfo = {
			socketID: socketID,
			title 	: roomTitle,
			filter 	: {
				gender 				: filterGender,
				peopleLimtNumber 	: peopleLimtNumber
			}
		};

		$.post('/add_room', addRoomInfo).done((result)=>{
			if(result.state === 'succes'){
				var roomKey = result.data;
				joinRoom(roomKey);
			}else{
				alert(result.data);
			}
		});
	});

	function updateRoomList(rooms){
		var $room = $('<div class="room"></div>')
		$roomList.html('');

		var len = rooms.length;
		if(len === 0){
			console.log('0');
			$roomList.text('Not found');
			return;
		}

		_.forEach(rooms, (room)=>{
			var $roomCopy = $room.clone();
			var roomInfo = [];

			roomInfo.push(room.title);

			roomInfo.push('참여자 수: ' + room.users.length);

			_.forEach(room.filter, function(n, key){
				roomInfo.push(key+': '+n);
			})

			$roomCopy.attr('id', room.roomKey);
			$roomCopy.text(roomInfo.join(' - '));

			$roomList.append($roomCopy);
		})
	}

	function updateRoom(room){
		$joiner.text([room.user].join(', '));
		$joinRoomTitle.text('title : ' + room.title);
		var filters = [];
		_.forEach(room.filter, function(n, key){
			filters.push(key+': '+n);
		})
		$filterInfo.text('filter : ' + filters.join(', '));

		var userNames = []
		_.forEach(room.users, function(name){
			userNames.push(name);
		})
		$users.text("참여자 목록: " + userNames.join(', '));
	}

	function joinRoom(roomKey){
		socket.emit('join room', roomKey);
	}

	function leaveRoom(){
		socket.emit('leave room');
	}
}

function chatCtrl($, socketID){
	var $content 	= $('#content');
	var $chatInput 	= $('#chat_input');
	

	$chatInput.on('keyup', (e)=>{
		if (e.keyCode == 13){
			sendMessage($chatInput.val());
			$chatInput.val('');
		}
	});

	

	socket.on('receive message', addMessage);

	socket.on('leave room', ()=>{
		alert('leave room');
	});

	

	function addMessage(message){
		$content.append('<div>'+message+'</div>');
	}

	function sendMessage(message){
		if (message.length < 1){
			alert('내용을 입력하세요.');
			return;
		}
		socket.emit('send message', message);
	}
}