var FAST_PACMAN = (function () {

    this.state = WAITING;
    this.audio = null;
    this.ghosts = [];
    this.ghostSpecs = ["#00FFDE", "#FF0000", "#FFB8DE", "#FFB847"];
    this.eatenCount = 0;
    this.level = 0;
    this.tick = 0;
    this.ghostPos = { x: 0, y: 0 };
    this.userPos = { x: 0, y: 0 };
    this.prevPos = { x: 0, y: 0 };
    this.stateChanged = true;
    this.timerStart = null;
    this.lastTime = 0;
    this.ctx = null;
    this.timer = null;
    this.map = null;
    this.user = null;
    this.stored = null;
    this.game = null;
    

	this.checkMap = function(y,x,z){
		if(Pacman.MAP[y][x] > 0)
			return 1;
		return 0;
	}
	
	this.seekPellet = function(){
		for(var i = 21; i > -1; i--){
			for(var j = 0; j < this.map.getMap()[i].length; j++){
				if(this.map.getMap()[i][j] == 1)
					return [j,i]
			}
		}
		return 1,1;
	}
	
	
	this.otherSeekPellet = function(){
		for(var i = 0; i < this.map.getMap().length; i++){
			for(var j = 0; j < this.map.getMap()[i].length; j++){
				if(this.map.getMap()[i][j] == 1)
					return [j,i]
			}
		}
		return 1,1;
	}
	
	this.sumMap = function(){
		var map = this.map.getMap();
		var flatMap = [];
		for(var  i = 0; i < map.length; i++){
			for(var j = 0; j < map[i].length; j++){
				flatMap.push(i);
				flatMap.push(j);
				flatMap.push(this.checkMap(i,j,1));
			}
		}
		return flatMap;
	}
	
	
	this.getState = function() {
        var inputs = [];
		var x = Math.round(this.user.position["x"] / 10);
		var y = Math.round(this.user.position["y"] / 10);
        inputs.push(x);
        inputs.push(y);
		
		var left_x = x - 1;
		var right_x = x + 1;
		var up_y = y-1;
		var down_y = y+1;
		//board is 22x19
		
		if(left_x < 0)
			inputs.push(0);
		else
			inputs.push(this.checkMap(y,left_x,1));
			
		if(right_x > 19)
			inputs.push(0);
		else
			inputs.push(this.checkMap(y,right_x,2));
			
		if(up_y < 0)
			inputs.push(0);
		else
			inputs.push(this.checkMap(up_y,x,3));
		
		if(down_y > 22)
			inputs.push(0);
		else
			inputs.push(this.checkMap(down_y,x,4));
		
		
        for (var i = 0; i < this.ghosts.length; i += 1) {
			var ghostX = Math.round(this.ghosts[i].position["x"]/10);
			var ghostY = Math.round(this.ghosts[i].position["y"]/10);
			var absX = Math.abs(ghostX-x);
			var absY = Math.abs(ghostY-y)
            inputs.push(absX);
            inputs.push(absY);
        }
		
		var nextPellet = this.seekPellet();
		var pelletX = nextPellet[0];
		var pelletY = nextPellet[1];
		inputs.push(Math.abs(x-pelletX));
		inputs.push(Math.abs(x-pelletY));
		
		//var mapIn = this.sumMap();
		//inputs.concat(mapIn);
		
        return inputs;
    };

    this.getTick = function() {
        return this.tick;
    };

    this.startLevel = function () {
        this.user.resetPosition();
        for (var i = 0; i < this.ghosts.length; i += 1) {
            this.ghosts[i].reset();
        }

        this.timerStart = this.tick;
        this.setState(COUNTDOWN);
    }

    this.startNewGame = function(neuralAgent, game) {

        this.setState(WAITING);
        this.level = 1;
        this.user.neuralAgent = neuralAgent
        this.game = game;
        this.user.reset();
        this.map.reset();
        this.startLevel();
    }
    
    this.keyDown = function(e) {
        if (e.keyCode === KEY.N) {
            this.startNewGame();
        } else if (e.keyCode === KEY.P) {
            this.stored = state;
            this.setState(PAUSE);
        } else if (state !== PAUSE) {
            return this.user.keyDown(e);
        }
        return true;
    }

    this.loseLife = function () {
        this.setState(WAITING);
        this.user.loseLife();
        if (this.user.getLives() > 0) {
            this.startLevel();
        }
    }

    this.setState = function(nState) {
        this.state = nState;
        this.stateChanged = true;
    };

    this.collided = function(user, ghost) {
        return (Math.sqrt(Math.pow(ghost.x - user.x, 2) +
                          Math.pow(ghost.y - user.y, 2))) < 10;
    };

    this.update = function()
    {
        //if (this.tick % 1000 == 0)
        //    console.log("UPDATE - Tick: " + this.tick + " Score: " + this.user.theScore());

        this.dt = .01;
        this.mainLoop(this.dt);

    }

    this.mainDraw = function(dt) {

        var diff, u, i, len, nScore;

        ghostPos = [];

        for (var i = 0, len = this.ghosts.length; i < len; i += 1) {
            ghostPos.push(this.ghosts[i].move(this.ctx));
        }
        
        this.prevPos = this.user.position;
        u = this.user.move(this, this.ctx, this.dt);
        this.userPos = u["new"];

        //lose points for sitting still
        if (this.prevPos.x == this.userPos.x && this.prevPos.y == this.userPos.y)
            this.user.addScore(-.1);


        for (var i = 0, len = this.ghosts.length; i < len; i += 1) {
            if (this.collided(this.userPos, ghostPos[i]["new"])) {
                if (this.ghosts[i].isVunerable()) {
                    this.ghosts[i].eat();
                    this.eatenCount += 1;
                    nScore = this.eatenCount * 50;
                    this.user.addScore(nScore);
                    this.setState(EATEN_PAUSE);
                    this.timerStart = this.tick;
                } else if (this.ghosts[i].isDangerous()) {
                    this.setState(DYING);
                    this.timerStart = this.tick;
                }
            }
        }


        if (this.game.visuals) {
            this.realDraw(this.ctx);
        }
    };

    this.realDraw = function(ctx)
    {
        this.map.drawPills(ctx);
        
        this.map.draw(ctx);
        this.realMainDraw(ctx);
        this.drawFooter(ctx);
    }

    this.realMainDraw = function (ctx) {

        for (var i = 0; i < this.ghosts.length; i += 1) {
            this.redrawBlock(this.ghosts[i].position);
        }

        this.redrawBlock(this.user.position);

        for (var i = 0; i < this.ghosts.length; i += 1) {
            this.ghosts[i].draw(ctx);
        }

        this.user.draw(ctx);
    }

    this.redrawBlock = function(pos) {
        this.map.drawBlock(Math.floor(pos.y / 10), Math.floor(pos.x / 10), this.ctx);
        this.map.drawBlock(Math.ceil(pos.y / 10), Math.ceil(pos.x / 10), this.ctx);
    }

    this.drawFooter = function(ctx) {

        var topLeft = (this.map.height * this.map.blockSize),
            textBase = topLeft + 17;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, topLeft, (this.map.width * this.map.blockSize), 30);

        ctx.fillStyle = "#FFFF00";

        for (var i = 0, len = this.user.getLives() ; i < len; i++) {
            ctx.fillStyle = "#FFFF00";
            ctx.beginPath();
            ctx.moveTo(150 + (25 * i) + this.map.blockSize / 2,
                       (topLeft + 1) + this.map.blockSize / 2);

            ctx.arc(150 + (25 * i) + this.map.blockSize / 2,
                    (topLeft + 1) + this.map.blockSize / 2,
                    this.map.blockSize / 2, Math.PI * 0.25, Math.PI * 1.75, false);
            ctx.fill();
        }

        ctx.fillStyle =  "#00FF00";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("s", 10, textBase);

        ctx.fillStyle = "#FFFF00";
        ctx.font = "14px BDCartoonShoutRegular";
        ctx.fillText("Score: " + this.user.theScore(), 30, textBase);
        ctx.fillText("Level: " + this.level, 260, textBase);
    }


    this.mainLoop = function() {

        var diff;

        if (!this.game.playing)
        {
            return;
        }

        if (this.state !== PAUSE) {
            this.tick++;
        }

        if (this.state === PLAYING) {
            this.mainDraw();
        } else if (this.state === WAITING && this.stateChanged) {
            this.stateChanged = false;
        } else if (this.state === EATEN_PAUSE) {
            this.setState(PLAYING);
        } else if (this.state === DYING) {

            //console.log("DEAD - Final Score:" + this.user.theScore());
			//console.log("Died at postion: " + this.user.position["x"]/10 + "," + this.user.position["y"]/10);
            this.game.subSimCompleted(this.user.theScore());

        } else if (this.state === COUNTDOWN) {
            this.setState(PLAYING);
        }
    }

    this.eatenPill = function() {
        this.timerStart = this.tick;
        this.eatenCount = 0;
        for (var i = 0; i < this.ghosts.length; i += 1) {
            this.ghosts[i].makeEatable(this.ctx);
        }
    };

    this.completedLevel = function() {
        this.setState(WAITING);
        this.level += 1;
        this.map.reset();
        this.user.newLevel();
        this.startLevel();
    };

    this.keyPress = function(e) {
        if (this.state !== WAITING && state !== PAUSE) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    this.init = function(wrapper, root) {
        console.log("Initializing!");
        var i, len, ghost,
            blockSize = wrapper.offsetWidth / 19,
            canvas = document.createElement("canvas");

        canvas.setAttribute("width", (blockSize * 19) + "px");
        canvas.setAttribute("height", (blockSize * 22) + 30 + "px");

        wrapper.appendChild(canvas);

        this.ctx = canvas.getContext('2d');

        this.map = new Pacman.Map(blockSize);

        this.user = new Pacman.User(this, this.map);

        this.user.reset();

        for (var i = 0; i < this.ghostSpecs.length; i += 1) {
            var ghost = new Pacman.Ghost({ "getTick": this.getTick }, this.map, this.ghostSpecs[i]);
            this.ghosts.push(ghost);
        }
    };
});