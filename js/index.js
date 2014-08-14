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

    }

    // Establishes prototype chain for class to inherit from View
    AppView.prototype = Object.create(View.prototype);
    AppView.prototype.constructor = AppView;

    // Default options for class
    AppView.DEFAULT_OPTIONS = {
        // initially empty
    };

    // Define your helper functions and prototype methods here:

    // Creates acrollView and background
    function _createScrollBackground() {

        // Create scrollView from array
        this.scrollViews = [];
        this.scrollview = new Scrollview();
        this.scrollview.sequenceFrom(this.scrollViews);

        // Create background view and backround surface, fixed heigt 500px
        this.backgroundView = new View({
            size: [undefined, 500]
        });
        var backSurface = new Surface({
            size: [undefined, 500],
            properties: {
                backgroundColor: '#ccc'
            }
        });

        // IMPORTANT! Pipe surface events to Scrollview,
        // otherwise you can't scroll!
        backSurface.pipe(this.scrollview);

        // add surface to view
        this.backgroundView.add(backSurface);
    }

    module.exports = AppView;
});