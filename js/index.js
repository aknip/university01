define('main', function (require, exports, module) {
    var Engine = require('famous/core/Engine');

    var mainContext = Engine.createContext();

    // Custom Modules
    var AppView = require('AppView');

    var appView = new AppView();
    mainContext.add(appView);
  
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
    var Modifier         = require('famous/core/Modifier');
    var Transform = require('famous/core/Transform');
    var Timer = require('famous/utilities/Timer');

    // Constructor function for our class
    function AppView() {
        // Applies View's constructor function to class
        View.apply(this, arguments);

        // Construct centered root node
        this.rootModifier = new StateModifier({
            origin: [0, 0]
        });
        this.mainNode = this.add(this.rootModifier);

        _createScrollBackground.call(this);

        this.scrollViews.push(this.backgroundView);
        this.mainNode.add(this.scrollview);
      
        // read actual width of background surface, this is needed to 
        // calculate the optimal grid later
        // the surface.getSize(true) method can not be used immediatelly,
        // because it the surface is not rendered.
        // A timeout after 16ms (1/60 sec) ensures, that it is rendered
        Timer.setTimeout( function () {
          // store actual width property
          this.actualWidth = this.backSurface.getSize(true)[0];
          console.log('Actual width of background surface: ' + this.actualWidth);
          // calculate optimal grid
          this.calculateGrid();      
          _createGrid.call(this);
        }.bind(this), 16);

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
        cellGutter: [30,30],
        cellOffset: [50,40],
        // size of scroll background
        scrollAreaSize: [undefined,undefined]
    };

    // Define your helper functions and prototype methods here:
  
    // Calculation of optimal cell sizes and row/column distribution
    // based on default option paramters above
    AppView.prototype.calculateGrid = function() {
      // Calculate all sizes and dimensions for the grid
      // 1. Number of cells fitting into width
      this.numberOfcellsX  = Math.floor((this.actualWidth - this.options.cellOffset[0]*2 + this.options.cellGutter[0]) / (this.options.cellMinSize[0] +this.options.cellGutter[0]));
      // 2. Number of cells fitting into height                                  
      this.numberOfcellsY  = Math.ceil(this.options.cellCount * 1.0 / this.numberOfcellsX);
      // 3. Calculated optimized sizes for the cells:
      // Optimized width, based on space
      this.options.cellCalculatedSize[0] = Math.floor((this.actualWidth - this.options.cellOffset[0]*2 - (this.numberOfcellsX-1)*this.options.cellGutter[0]) / this.numberOfcellsX);
      // Optimized height, proportionally scaled
      this.options.cellCalculatedSize[1] = this.options.cellCalculatedSize[0]/this.options.cellMinSize[0]*this.options.cellMinSize[1] ;

      // Height of ScrollArea:
      this.options.scrollAreaSize[1] = this.numberOfcellsY * this.options.cellCalculatedSize[1] + this.options.cellOffset[1]*2 + ((this.numberOfcellsY-1) * this.options.cellGutter[1]);
      
      console.log("number of cells X: " + this.numberOfcellsX );
      console.log("number of cells Y: " + this.numberOfcellsY );
      console.log("calculated cell width: " + this.options.cellCalculatedSize[0] );
      console.log("calculated cell height: " + this.options.cellCalculatedSize[1] );
      console.log("calculated height of scroll area " + this.options.scrollAreaSize[1] );
      
    };
  
  
    // Creates manually computed grid based on option parameters
    function _createGrid() {
      // Set height of background ScrollArea to calculated size
      this.backSurface.size[1]=this.options.scrollAreaSize[1];
      this.backgroundView.options.size[1]=this.options.scrollAreaSize[1];
      
      // Init array of navModifiers, will be used later for animation
      this.navModifiers = [];
      var xCount = 0;
      var yCount = 0;

      for(var i = 0; i < this.options.cellCount; i++) {
        // calculates x position and y postion during the loop
        xCount = i % this.numberOfcellsX;
        yCount = Math.floor(i*1.0 / this.numberOfcellsX);

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
        
        // store default position in object (will be used later for animatino)
        navModifier.cellDefaultPosition = [xOffset,yOffset];
        
        // IMPORTANT! Pipe surface events to Scrollview,
        // otherwise you can't scroll!
        contentSurface.pipe(this.scrollview);

        // add each item to the view and store navModifier in array
        this.navModifiers.push(navModifier);
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