define('main', function (require, exports, module) {
    var Engine = require('famous/core/Engine');

    var mainContext = Engine.createContext();

    // Custom Modules
    var AppView = require('AppView');

    var appView = new AppView();
    mainContext.add(appView);

    Engine.pipe(appView._eventOutput);

});

/**
 *************** AppViews ****************
 */


define('AppView', function (require, exports, module) {
    'use strict';

    // Import additional modules to be used in this view
    var View = require('famous/core/View');
    var Surface = require('famous/core/Surface');
    var Scrollview = require('famous/views/Scrollview');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Modifier = require('famous/core/Modifier');
    var Transform = require('famous/core/Transform');
    var Timer = require('famous/utilities/Timer');
    var ScrollbarView = require('ScrollbarView');

    // Constructor function for our class
    function AppView() {
        // Applies View's constructor function to class
        View.apply(this, arguments);

        // Construct centered root node
        this.rootModifier = new StateModifier({
            origin: [0, 0]
        });
        this.mainNode = this.add(this.rootModifier);

        // empty surface behind ScrollBackground, just used to get size of current view
        this.sizeGetter = this.mainNode.add(new Surface);

        _createScrollBackground.call(this);

        this.scrollViews.push(this.backgroundView);
        this.mainNode.add(this.scrollview);


        // read actual width of background surface, this is needed to 
        // calculate the optimal grid later:
        // the surface.getSize(true) method (used inside of .calculateGrid()) 
        // can not be used immediatelly, because the surface is not already rendered.
        // A timeout after 16ms (1/60 sec) ensures, that it is rendered 
        // before the function is called.
        Timer.setTimeout(function () {
            // calculate optimal grid
            this.calculateGrid();
            _createGrid.call(this);
            this.resetNavItems();
            this.animateNavItems();
            // Pass paramters to scrollbar widget
            this.scrollbarView = new ScrollbarView({
                scrollView: this.scrollview,
                scrollBackgroundSize: [this.actualWidth, this.actualHeight],
                fullContentHeight: this.options.scrollAreaSize[1]
            });
            this.mainNode.add(this.scrollbarView);
            this.on('prerender', function () {
                this.scrollbarView.updateScrollbarPosition();
            }.bind(this));

        }.bind(this), 16);


        // Resize grid if application is resized (browser width changed)
        this.on('resize', function () {
            // calculate new
            this.calculateGrid();
            // set sizes, positions of all cells new 
            var xCount = 0;
            var yCount = 0;
            for (var i = 0; i < this.options.cellCount; i++) {
                // calculates x position and y postion during the loop
                xCount = i % this.numberOfcellsX;
                yCount = Math.floor(i * 1.0 / this.numberOfcellsX);
                // calculate position of cell, based on x/y/offset/gutter
                var xOffset = this.options.cellOffset[0] + (this.options.cellCalculatedSize[0] + this.options.cellGutter[0]) * xCount;
                var yOffset = this.options.cellOffset[1] + (this.options.cellCalculatedSize[1] + this.options.cellGutter[1]) * yCount;
                // Transform.translate(..., ..., 1) transforms
                // z-axis by 1 and ensures that the cells
                // always stay on top of the background
                this.navModifiers[i].setTransform(Transform.translate(xOffset, yOffset, 1));
                // store default position in object (will be used later for animations)
                this.navModifiers[i].cellDefaultPosition = [xOffset, yOffset];
                // set new cell sizes
                this.navCells[i].size = this.options.cellCalculatedSize;
                // set new background size
                this.backSurface.size[1] = this.options.scrollAreaSize[1];
                this.backgroundView.options.size[1] = this.options.scrollAreaSize[1];
            }

            this.animateNavItems();

            this.scrollbarView.resizeSlider({
                scrollBackgroundSize: [this.actualWidth, this.actualHeight],
                fullContentHeight: this.options.scrollAreaSize[1]
            });
        });


    }

    // Establishes prototype chain for class to inherit from View
    AppView.prototype = Object.create(View.prototype);
    AppView.prototype.constructor = AppView;

    // Default options for class
    AppView.DEFAULT_OPTIONS = {
        // number of cells
        cellCount: 50,
        // minimal size of each cell
        cellMinSize: [150, 150],
        // current size of each cell (calculated for optimal fit)
        cellCalculatedSize: [undefined, undefined],
        // gutters and offset
        cellGutter: [30, 30],
        cellOffset: [50, 40],
        // size of scroll background
        scrollAreaSize: [undefined, undefined],
        // animation paramters
        duration: 400,
        staggerDelayMs: 20
    };

    // Define your helper functions and prototype methods here:

    // Calculation of optimal cell sizes and row/column distribution
    // based on default option paramters above
    AppView.prototype.calculateGrid = function () {
        // store actual width property
        this.actualWidth = this.sizeGetter.getSize(true)[0];
        this.actualHeight = this.sizeGetter.getSize(true)[1];
        // Calculate all sizes and dimensions for the grid
        // 1. Number of cells fitting into width
        this.numberOfcellsX = Math.floor((this.actualWidth - this.options.cellOffset[0] * 2 + this.options.cellGutter[0]) / (this.options.cellMinSize[0] + this.options.cellGutter[0]));
        // 2. Number of cells fitting into height                                  
        this.numberOfcellsY = Math.ceil(this.options.cellCount * 1.0 / this.numberOfcellsX);
        // 3. Calculated optimized sizes for the cells:
        // Optimized width, based on space
        this.options.cellCalculatedSize[0] = Math.floor((this.actualWidth - this.options.cellOffset[0] * 2 - (this.numberOfcellsX - 1) * this.options.cellGutter[0]) / this.numberOfcellsX);
        // Optimized height, proportionally scaled
        this.options.cellCalculatedSize[1] = this.options.cellCalculatedSize[0] / this.options.cellMinSize[0] * this.options.cellMinSize[1];

        // Height of ScrollArea:
        this.options.scrollAreaSize[1] = this.numberOfcellsY * this.options.cellCalculatedSize[1] + this.options.cellOffset[1] * 2 + ((this.numberOfcellsY - 1) * this.options.cellGutter[1]);

        console.log('Actual width of background surface: ' + this.actualWidth);
        console.log('Actual height of background surface: ' + this.actualHeight);
        console.log("number of cells X: " + this.numberOfcellsX);
        console.log("number of cells Y: " + this.numberOfcellsY);
        console.log("calculated cell width: " + this.options.cellCalculatedSize[0]);
        console.log("calculated cell height: " + this.options.cellCalculatedSize[1]);
        console.log("calculated height of scroll area " + this.options.scrollAreaSize[1]);

    };

    // reset position of all cells: move them outside the screen
    // so that they can fly in
    AppView.prototype.resetNavItems = function () {
        // reset positions to the right 
        // and fade all cells out (opacity)
        for (var i = 0; i < this.navModifiers.length; i++) {
            // xPos * 1.5
            var initX = this.navModifiers[i].cellDefaultPosition[0] + this.options.cellMinSize[0] * 1.5;
            // yPos * 2.0
            var initY = this.navModifiers[i].cellDefaultPosition[1] + this.options.cellMinSize[1] * 2.0;
            // store new values in navModifiers array
            this.navModifiers[i].setOpacity(0.0);
            this.navModifiers[i].setTransform(Transform.translate(initX, initY, 0));
        }
    };


    AppView.prototype.animateNavItems = function () {
        for (var i = 0; i < this.navModifiers.length; i++) {
            // use Timer.setTimeout (famous/utilities) 
            // instead of window.setTimeout for higher accurancy    
            Timer.setTimeout(function (i) {
                var xOffset = this.navModifiers[i].cellDefaultPosition[0];
                var yOffset = this.navModifiers[i].cellDefaultPosition[1];
                // store new values in navModifiers array
                this.navModifiers[i].setOpacity(1, { duration: this.options.duration, curve: 'easeOut' });
                this.navModifiers[i].setTransform(
                    Transform.translate(xOffset, yOffset, 0),
                    { duration: this.options.duration, curve: 'easeOut' });
                // setTimeout values are calculated for each cell, thus
                // the staggering effect is created
            }.bind(this, i), i * this.options.staggerDelayMs);

        }
    };


    // Creates manually computed grid based on option parameters
    function _createGrid() {
        // Set height of background ScrollArea to calculated size
        this.backSurface.size[1] = this.options.scrollAreaSize[1];
        this.backgroundView.options.size[1] = this.options.scrollAreaSize[1];

        // Init array of navModifiers, will be used later for animation
        this.navModifiers = [];
        this.navCells = [];
        var xCount = 0;
        var yCount = 0;

        for (var i = 0; i < this.options.cellCount; i++) {
            // calculates x position and y postion during the loop
            xCount = i % this.numberOfcellsX;
            yCount = Math.floor(i * 1.0 / this.numberOfcellsX);

            // create cells: view and surface (view is used for future enhancements)
            var navView = new View();
            var contentSurface = new Surface({
                content: "PANEL " + (i + 1),
                size: [this.options.cellCalculatedSize[0], this.options.cellCalculatedSize[1]],
                properties: {
                    backgroundColor: "hsl(" + (i * 360 / 8) + ", 60%, 50%)",
                    fontFamily: "Roboto",
                    fontWeight: 300,
                    color: "white",
                    textAlign: "center",
                    lineHeight: "100px"
                }
            });
            navView._add(contentSurface);

            // calculate position of cell, based on x/y/offset/gutter
            var xOffset = this.options.cellOffset[0] + (this.options.cellCalculatedSize[0] + this.options.cellGutter[0]) * xCount;
            var yOffset = this.options.cellOffset[1] + (this.options.cellCalculatedSize[1] + this.options.cellGutter[1]) * yCount;
            // Transform.translate(..., ..., 1) transforms
            // z-axis by 1 and ensures that the cells
            // always stay on top of the background
            var navModifier = new Modifier({
                transform: Transform.translate(xOffset, yOffset, 1)
            });

            // store default position in object (will be used later for animations)
            navModifier.cellDefaultPosition = [xOffset, yOffset];

            // IMPORTANT! Pipe surface events to Scrollview,
            // otherwise you can't scroll!
            contentSurface.pipe(this.scrollview);

            // add each item to the view and store navModifier in array
            this.navModifiers.push(navModifier);
            this.navCells.push(contentSurface);
            this.backgroundView.add(navModifier).add(navView);
        }

    }


    // Creates scrollView and background
    function _createScrollBackground() {

        // Create scrollView from array
        this.scrollViews = [];
        this.scrollview = new Scrollview();
        this.scrollview.sequenceFrom(this.scrollViews);

        // Create background view and backround surface
        this.backgroundView = new View({
            size: [this.options.scrollAreaSize[0], this.options.scrollAreaSize[1]]
        });
        this.backSurface = new Surface({
            size: [this.options.scrollAreaSize[0], this.options.scrollAreaSize[1]],
            properties: {
                backgroundColor: '#ccc'
            }
        });

        // IMPORTANT! Pipe surface events to Scrollview,
        // otherwise you can't scroll!
        this.backSurface.pipe(this.scrollview);

        // add surface to view
        this.backgroundView.add(this.backSurface);
    }

    module.exports = AppView;
});

/**
 *************** ScrollbarView ****************
 */

// Adds scrollbar, eg. for desktop users. Responsive design / reacts on screen resizes

define('ScrollbarView', function (require, exports, module) {
    'use strict';

    // Import additional modules to be used in this view
    var View = require('famous/core/View');
    var Surface = require('famous/core/Surface');
    var Transform = require('famous/core/Transform');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Draggable = require('famous/modifiers/Draggable');

    // Constructor function for our class
    function ScrollbarView() {
        // Applies View's constructor function to class
        View.apply(this, arguments);

        // make sure you invoke the helper function
        // in the right context by using .call()
        _createScroller.call(this);

    }

    // Establishes prototype chain for class to inherit from View
    ScrollbarView.prototype = Object.create(View.prototype);
    ScrollbarView.prototype.constructor = ScrollbarView;

    // Default options for class, eg. the size property
    ScrollbarView.DEFAULT_OPTIONS = {
        // just for initialization, will be changed by .calculateSlider() 
        scrollView: undefined,
        scrollBackgroundSize: [100, 100],
        fullContentHeight: 100,
        // visible scrollbar width and offset:
        scrollBarWidth: 1,
        scrollBarOffset: [10, 10]
    };

    // Define your helper functions and prototype methods here:
    // the _ before the function name indicates it's a private function
  
    // creates scroller
    // scroller consists of a visible surface and an unvisible surface, which is used to define
    // the draggable area (which must be bigger, especially if the visible scroller is only a few pixels wide)
    function _createScroller() {

        this.scrollerDraggableArea = new Surface({
            properties: {
                cursor: 'pointer'
            }
        })

        this.scrollerVisibleArea = new Surface({
            properties: {
                backgroundColor: 'white',
                boxShadow: '0px 5px 10px 1px rgba(0, 0, 0, 0.3)',
                cursor: 'pointer'
            }
        })

        
        this.scrollerDraggableArea.draggable = new Draggable();

        // sizes are calculated dynamically / responsivelly by calling this function:
        this.calculateSlider();
      
      
        // create view based on the two surfaces:
        this.scrollerView = new View;
        this.scrollerView
            .add(this.scrollerDraggableArea);
        this.scrollerView
            .add(new StateModifier({
                transform: Transform.translate(this.options.scrollBarOffset[0], this.options.scrollBarOffset[1], 1),
                origin: [0, 0] }))
            .add(this.scrollerVisibleArea);

        // pipe events - otherwise draggable area will not react...
        this.scrollerDraggableArea.pipe(this.scrollerDraggableArea.draggable);
        this.scrollerVisibleArea.pipe(this.scrollerDraggableArea.draggable);

        this
            .add(this.scrollerDraggableArea.draggable)
            .add(this.scrollerView);

        // flag which reflects, if user is currently dragging the slider or just swiping/scrolling
        this.dragging = false;

        this.scrollerDraggableArea.draggable.on('start', function (e) {
            this.dragging = true;
        }.bind(this));

        this.options.scrollView.sync.on('start', function () {
            this.dragging = false;
        }.bind(this));
    }

    // updates slider position and/or scrollview position
    ScrollbarView.prototype.updateScrollbarPosition = function () {
      
        if (this.dragging == true) {

            var maxBar = this.options.scrollBackgroundSize[1] - this.scrollbarSize;
            var barPos = this.scrollerDraggableArea.draggable.getPosition()[1] * 1.0 / ( maxBar * 1.0);
            var maxScroll = this.options.fullContentHeight - this.options.scrollBackgroundSize[1];
            var posY = maxScroll * barPos;

            // This getPosition() is needed to prevent some quirkiness
            this.options.scrollView.getPosition();
            this.options.scrollView.setPosition(posY);
            this.options.scrollView.setVelocity(0);

        } else {

            this.calculateSlider();

        }

    };

     
    // calculates slider size and position, dependent on scrollview-size and actual scroll position
    ScrollbarView.prototype.calculateSlider = function () {

        var maxScroll = this.options.fullContentHeight - this.options.scrollBackgroundSize[1];
        var scrollPos = this.options.scrollView.getPosition() / maxScroll;
        var barPosition = scrollPos * (this.options.scrollBackgroundSize[1] - this.scrollbarSize);

        this.scrollbarSize = this.options.scrollBackgroundSize[1] * this.options.scrollBackgroundSize[1] / ( this.options.fullContentHeight );

        this.scrollerDraggableArea.draggable.setPosition([0, barPosition, 0]);

        this.scrollerDraggableArea.setOptions({
            size: [40, this.scrollbarSize]
        })

        this.scrollerVisibleArea.setOptions({
            size: [this.options.scrollBarWidth, this.scrollbarSize - 2 * this.options.scrollBarOffset[1]]
        })

        this.scrollerDraggableArea.draggable.setOptions({
            xRange: [0, 0],
            yRange: [0, this.options.scrollBackgroundSize[1] - this.scrollbarSize]
        })

    }
    
    
    // resize - triggered by parent view 'on('resize')'
    ScrollbarView.prototype.resizeSlider = function (options) {

        this.options.scrollBackgroundSize = options.scrollBackgroundSize;
        this.options.fullContentHeight = options.fullContentHeight;

        this.calculateSlider();

    };


    module.exports = ScrollbarView;
});