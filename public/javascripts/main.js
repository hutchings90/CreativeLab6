angular.module('App', [])
.controller('MainCtrl', ['$scope', '$http', '$interval', '$timeout', function($scope, $http, $interval, $timeout){
    const DIMENSIONS = 8;
    const ID_COUNT = 7;
    const DISTANCE = 2;
    const TIME_INCREMENT = 100;

    firebase.auth().onAuthStateChanged(function(user){
        $scope.user = user;
        if($scope.user){
            document.getElementById('sign-in-wrapper').style.display = 'none';
            document.getElementById('game').style.display = 'block';
            document.getElementById('audio').currentTime = 0;
            document.getElementById('audio').play();
            database.ref().child('users/' + $scope.user.uid).once('value').then(function(snapshot){
                if(!snapshot.val()){
                    database.ref().child('users/' + $scope.user.uid).set({
                        email: $scope.user.email,
                    }).then($scope.initGame)
                }
                else{
                    $scope.initGame();
                }
            }).then(start);
        }
        else{
            document.getElementById('sign-in-wrapper').style.display = 'block';
            document.getElementById('game').style.display = 'none';
            document.getElementById('audio').pause();
        }
    });

    $scope.initGame = function(){
        $scope.user.gameRef = database.ref().child('users/' + $scope.user.uid + '/games').push({
            score: 0,
            moves: 0,
            time: 0,
        });
        $scope.user.gameRef.once('value').then(function(snapshot){
            $scope.user.gameKey = snapshot.key;
        });
        $scope.user.gamesRef = database.ref().child('users/' + $scope.user.uid + '/games');
        $scope.user.gamesRef.once('value').then($scope.snapshotToGames);
    }

    $scope.toggleLogin = function(){
        if(!firebase.auth().currentUser) signIn();
        else signOut();
    };

    $scope.snapshotToGames = function(snapshot){
        $scope.games = snapshot.val();
        $scope.game = $scope.games[$scope.user.gameKey];
        delete $scope.games[$scope.user.gameKey];
    }

    function signIn(){
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithRedirect(provider);
    }

    function signOut(){
        firebase.auth().signOut();
    }

    $scope.restart = start;
    $scope.submitStyle = {
        'background-color': '#00ff00',
        'color': 'black',
        'cursor': 'pointer'
    };

    $scope.clickedZombie = function(zombie){
        if($scope.selectedZombies.length > 1) return;
        if($scope.selectedZombies.length < 1){
            zombie.class = 'zombie-space selected';
            $scope.selectedZombies.push(zombie);
        }
        else if(!toSide($scope.selectedZombies[0], zombie)){
            $scope.selectedZombies[0].class = 'zombie-space';
            ($scope.selectedZombies[0] = zombie).class = 'zombie-space selected';
        }
        else{
            $scope.moves++;
            $scope.selectedZombies.push(zombie);
            $scope.selectedZombies[0].class = 'zombie-space';
            $scope.updateAddition(attemptHit($scope.zombies, $scope.selectedZombies[0], $scope.selectedZombies[1]), $scope.addition.class = 'addition-update');
            $timeout(function(){
                $scope.updateAddition(0, 'hidden');
            }, 5000);
            if($scope.addition.value > 0){
                $scope.score += $scope.addition.value;
                $scope.user.gameRef.set({
                    moves: $scope.moves,
                    score: $scope.score,
                    time: Math.round($scope.time.value * 100) / 100
                }).then(function(){
                    $scope.user.gamesRef.once('value').then($scope.snapshotToGames);
                });
                if(!playable($scope.zombies)) console.log("Not playable");
            }
            else swap($scope.zombies, $scope.selectedZombies[0], $scope.selectedZombies[1]);
            $scope.selectedZombies = [];
        }
    };

    $scope.submit = function(){
        var scoreObject = {
            score: $scope.score,
            moves: $scope.moves,
            time: $scope.time.value
        };
        console.log(scoreObject);
        console.log(firebase.database().ref());
    }

    $scope.updateAddition = function(value, style){
        $scope.addition.value = value;
        $scope.addition.string = '+' + $scope.addition.value + ($scope.addition.value > 0 ? '!' : '...');
        $scope.addition.class = style;
    }

    function attemptHit(board, zombie1, zombie2){
        var list;
        var score = 0;
        swap(board, zombie1, zombie2);

        list = isHit(board, zombie1);
        score += scoreHit(list);
        removeZombies($scope.zombies, list);

        list = list.concat(isHit(board, zombie2));
        while(list.length > 0){
            var addition = scoreHit(list);
            score += addition;
            removeZombies($scope.zombies, list);
            revertZombieClass(list);
            dropZombies($scope.zombies);
            addZombies($scope.zombies);
            list = getHits(board);
        }

        return score;
    }

    function revertZombieClass(toRevert){
        $timeout(function(){
            for(var i = 0; i < toRevert.length; i++)
                toRevert[i].class = 'zombie-space';
        }, 2500);
    }

    function dropZombies(board){
        for(var i = board.length - 1; i > 0; i--){
            for(var j = board[i].length - 1; j > -1; j--){
                var zombie1 = board[i][j];
                if(zombie1.id == ID_COUNT){
                    var row = i - 1;
                    while(row > 0 && board[row][j].id == ID_COUNT) row--;
                    var zombie2 = board[row][j];
                    zombie1.id = zombie2.id;
                    zombie1.value = zombie2.value;
                    zombie2.id = ID_COUNT;
                    zombie2.value = 0;
                }
            }
        }
    }

    function addZombies(board){
        for(var i = 0; i < board.length; i++){
            for(var j = 0; j < board[i].length; j++){
                var zombie = board[i][j];
                if(zombie.id == ID_COUNT){
                    zombie.id = Math.floor(Math.random() * ID_COUNT);
                    zombie.value = zombie.id + 1;
                }
            }
        }
    }

    function removeZombies(board, toRemove){
        for(var i = 0; i < toRemove.length; i++){
            var zombie = board[toRemove[i].row][toRemove[i].col];
            zombie.id = ID_COUNT;
            zombie.value = 0;
            zombie.class = 'zombie-space hit';
        }
    }

    function scoreHit(list){
        if(list.length <= DISTANCE) return 0;
        return list[0].value * list.length;
    }

    function swap(board, zombie1, zombie2){
        var temp = {
            id: zombie1.id,
            value: zombie1.value,
        };
        board[zombie1.row][zombie1.col].id = zombie2.id;
        board[zombie1.row][zombie1.col].value = zombie2.value;
        board[zombie2.row][zombie2.col].id = temp.id;
        board[zombie2.row][zombie2.col].value = temp.value;
    }

    function start(){
        $scope.zombies = generateZombies();
        $scope.addition = {};
        $scope.addition.value = 0;
        $scope.addition.string = '';
        $scope.score = 0;
        $scope.moves = 0;
        $scope.time = {string: '0', value: 0};
        $scope.selectedZombies = [];
        $interval(function(){
            $scope.time.value += TIME_INCREMENT / 1000;
            $scope.time.string = $scope.time.value.toFixed(1);
        }, TIME_INCREMENT);
    };

    function isHit(board, zombie){
        var returnList = [];
        var horizontalZombies = horizontalList(board, zombie.row, zombie.col, zombie.id);
        var verticalZombies = verticalList(board, zombie.row, zombie.col, zombie.id);
        if(horizontalZombies.length > DISTANCE) returnList = horizontalZombies;
        if(verticalZombies.length > DISTANCE) returnList = returnList.concat(verticalZombies);
        return returnList;
    }

    function horizontalList(board, row, col, id){
        var list = [board[row][col]];
        var curCol = col + 1;
        while(match(board, row, curCol, id)) list.push(board[row][curCol++]);
        curCol = col - 1;
        while(match(board, row, curCol, id)) list.push(board[row][curCol--]);
        return list;
    }

    function verticalList(board, row, col, id){
        var list = [board[row][col]];
        var curRow = row + 1;
        while(match(board, curRow, col, id)) list.push(board[curRow++][col]);
        curRow = row - 1;
        while(match(board, curRow, col, id)) list.push(board[curRow--][col]);
        return list;
    }

    function toSide(zombie1, zombie2){
        var rowDistance = Math.abs(zombie1.row - zombie2.row);
        var colDistance = Math.abs(zombie1.col - zombie2.col);
        switch(rowDistance){
        case 0: return (colDistance == 1);
        case 1: return (colDistance == 0);
        }
        return false;
    }

    function generateZombies(){
        var zombies;
        var count;
        var hitList = [];
        do{
            count = 0;
            zombies = [];
            for(var i = 0; i < DIMENSIONS; i++){
                var row = [];
                for(var j = 0; j < DIMENSIONS; j++){
                    var zombie = {};
                    zombie.id = Math.floor(Math.random() * ID_COUNT);
                    zombie.value = zombie.id + 1;
                    zombie.background = Math.floor((i + j) % 2);
                    zombie.class = 'zombie-space';
                    zombie.row = i;
                    zombie.col = j;
                    row.push(zombie);
                }
                zombies.push(row)
            }
            do{
                hitList = getHits(zombies);
                for(var i = 0; i < hitList.length; i += 2){
                    hitList[i].id = Math.floor(Math.random() * ID_COUNT);
                    hitList[i].value = zombie.id + 1;
                }
            }while(hitList.length > 0);
            count++;
        } while(!playable(zombies) && count < 100);
        return zombies;
    }

function printInfo(zombieList, listName){
    console.log(listName + ".length = " + zombieList.length);
    for(var i = 0; i < zombieList.length; i++)
        console.log({id: zombieList[i].id, value: zombieList[i].value, row: zombieList[i].row, col: zombieList[i].col});
}

    function getHits(board){
        var returnList = [];
        for(var i = 0; i < board.length; i++)
            for(var j = 0; j < board[i].length; j++)
                returnList = returnList.concat(omitDuplicates(returnList, isHit(board, board[i][j])));
        return returnList;
    }

    function omitDuplicates(mainList, concatList){
        for(var i = 0; i < concatList.length; i++)
            if(isDuplicate(mainList, concatList[i])) concatList.splice(i--, 1);
        return concatList;
    }

    function isDuplicate(mainList, item){
        for(var j = 0; j < mainList.length; j++)
            if(item.row != mainList[j].row || item.col != mainList[j].col) return true;
        return false;
    }

    function playable(board){
        for(var i = 0; i < board.length; i++)
            for(var j = 0; j < board[i].length; j++)
                if(playableRowSection(board, i, j + 1, board[i][j].id, 1, 1, false)
                || playableColSection(board, i + 1, j, board[i][j].id, 1, 1, false)
                || playableRowSection(board, i, j - 1, board[i][j].id, -1, 1, false)
                || playableColSection(board, i - 1, j, board[i][j].id, -1, 1, false)) return true;
        return false;
    }

    function playableRowSection(board, row, col, id, direction, count, moved){
        if(count > DISTANCE) return true;
        if(match(board, row, col, id)) return playableRowSection(board, row, col + direction, id, direction, count + 1, moved);
        if(!moved
        && (match(board, row - 1, col, id)
            || match(board, row + 1, col, id)
            || (count == DISTANCE && match(board, row, col + direction, id)))) return playableRowSection(board, row, col + direction, id, direction, count + 1, true);
        return false;
    }

    function playableColSection(board, row, col, id, direction, count, moved){
        if(count > DISTANCE) return true;
        if(match(board, row, col, id)) return playableColSection(board, row + direction, col, id, direction, count + 1, moved);
        if(!moved
        && (match(board, row, col - 1, id)
            || match(board, row, col + 1, id)
            || (count == DISTANCE && match(board, row + direction, col, id)))) return playableColSection(board, row + direction, col, id, direction, count + 1, true);
        return false;
    }

    function match(board, row, col, id){
        if(!withinLimits(board, row, col, id)) return false;
        if(board[row][col].id != id) return false;
        return true;
    }

    function withinLimits(board, row, col){
        if(row < 0) return false;
        if(col < 0) return false;
        if(row >= board.length) return false;
        if(col >= board[row].length) return false;
        return true;
    }
}]);
