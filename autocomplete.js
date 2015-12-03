/*
    https://github.com/foo123/autocomplete
    
    adapted from:
    JavaScript autoComplete v1.0.3
    Copyright (c) 2014 Simon Steinberger / Pixabay
    GitHub: https://github.com/Pixabay/JavaScript-autoComplete
    License: http://www.opensource.org/licenses/mit-license.php
*/
!function( root, name, factory ) {
"use strict";
if ( 'object' === typeof exports )
    // CommonJS module
    module.exports = factory( );
else if ( 'function' === typeof define && define.amd )
    // AMD. Register as an anonymous module.
    define(function( req ) { return factory( ); });
else
    root[name] = factory( );
}(this, 'autoComplete', function( undef ) {
"use strict";

var HAS = 'hasOwnProperty', ATTR = 'getAttribute',
    SET_ATTR = 'setAttribute', DEL_ATTR = 'removeAttribute',
    ESC_RE = /[-\/\\^$*+?.()|[\]{}]/g,
    NOW = Date.now ? Date.now : function(){ return new Date().getTime(); },
    getStyle = window.getComputedStyle ? function(el){ return getComputedStyle(el, null); } : function(el){ return el.currentStyle; };

// helpers
function extend( o1, o2 )
{
    for (var k in o2)
    {
        if ( o2[HAS](k) )
            o1[k] = o2[k];
    }
    return o1;
}

function dynamic( instance, properties )
{
    // custom dynamic getter / setter for suggestions
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set
    /*Object.defineProperty(self, "suggestions", {
        get: function( ) {
            return cache[element.value] || [];
        },
        set: function( list ) {
            suggest( list || [] );
        }
    });*/
    // http://ejohn.org/blog/javascript-getters-and-setters/
    /*self.__defineGetter__("value", function( ){
        return val;
    });
    self.__defineSetter__("value", function( value ){
        val = value;
    });*/
    for (var p in properties)
    {
        if ( !properties[HAS](p) ) continue;
        if ( 'function' === typeof properties[p].get ) instance.__defineGetter__(p, properties[p].get);
        if ( 'function' === typeof properties[p].set ) instance.__defineSetter__(p, properties[p].set);
    }
    return instance;
}

function esc_re( s )
{
    return s.replace(ESC_RE, '\\$&');
}

function esc_html( s )
{
    var esc = '', i, l = s.length, ch;
    for(i=0; i<l; i++)
    {
        ch = s.charAt(i);
        if ( '&' === ch ) esc += '&amp;';
        else if ( '<' === ch ) esc += '&lt;';
        else if ( '>' === ch ) esc += '&gt;';
        else esc += ch;
    }
    return esc;
}

function id( id_selector, ctx )
{
    return (ctx||document).getElementById( id_selector );
}

function tag( tag_selector, ctx )
{
    return (ctx||document).getElementsByTagName( tag_selector );
}

function $( selector, ctx )
{
    return (ctx||document).querySelectorAll( selector );
}

function $1( selector, ctx )
{
    return (ctx||document).querySelector( selector );
}

function create( tag, className, html )
{
    var el = document.createElement( tag );
    if ( className ) el.className = className;
    if ( !!html ) el.innerHTML = html;
    return el;
}

function hasClass( el, className )
{
    return el.classList
        ? el.classList.contains(className)
        : new RegExp('\\b'+ className+'\\b').test(el.className)
    ;
}

function addClass( el, className )
{
    if ( !hasClass(el, className) )
    {
        if ( el.classList ) el.classList.add(className);
        else el.className += ' '+className;
    }
}

function removeClass( el, className )
{
    if ( el.classList ) el.classList.remove(className);
    else el.className = el.className.replace(className, '');
}

function addEvent( el, type, handler )
{
    if ( el.attachEvent ) el.attachEvent( 'on'+type, handler );
    else el.addEventListener( type, handler );
}

function removeEvent( el, type, handler )
{
    // if (el.removeEventListener) not working in IE11
    if ( el.detachEvent ) el.detachEvent( 'on'+type, handler );
    else el.removeEventListener( type, handler );
}

function live( class_selector, event, cb, ctx )
{
    addEvent(ctx||document, event, function( e ){
        var found = false, el = e.target || e.srcElement;
        while ( el && !(found = hasClass(el, class_selector)) ) el = el.parentElement;
        if ( found ) cb.call( el, e );
    });
}

function updateSC( element, sc, resize, next )
{
    var rect = element.getBoundingClientRect( );
    sc.style.left = (rect.left + (window.pageXOffset || document.documentElement.scrollLeft)) + 'px';
    sc.style.top = (rect.bottom + (window.pageYOffset || document.documentElement.scrollTop) + 1) + 'px';
    sc.style.width = (rect.right - rect.left) + 'px'; // outerWidth
    if ( !resize )
    {
        addClass(sc, 'visible');
        if ( !sc._maxHeight ) sc._maxHeight = parseInt(getStyle(sc).maxHeight, 10);
        if ( !sc._suggestionHeight ) sc._suggestionHeight = sc._empty ? $1('.autocomplete-no-suggestions', sc).offsetHeight : $1('.autocomplete-suggestion', sc).offsetHeight;
        
        if ( sc._suggestionHeight )
        {
            if ( !next ) sc.scrollTop = 0;
            else
            {
                var scrTop = sc.scrollTop, selTop = next.getBoundingClientRect().top - sc.getBoundingClientRect().top;
                if ( selTop + sc._suggestionHeight - sc._maxHeight > 0 )
                    sc.scrollTop = selTop + sc._suggestionHeight + scrTop - sc._maxHeight;
                else if ( selTop < 0 )
                    sc.scrollTop = selTop + scrTop;
            }
        }
    }
}

function update_instances( e )
{
    if ( !instances.length ) return;
    for(var i=0,l=instances.length; i<l; i++)
        updateSC( instances[i].element, instances[i].sc, e );
}

var instances = [ ];

function autoComplete( element, options )
{
    var self = this;

    options = extend({
        // defaults
        source: 0,
        minChars: 3,
        delay: 150,
        key: null,
        value: null,
        cache: 5000,
        menuClass: '',
        noItems: 'No Matches for <strong>{{term}}</strong>',
        renderItem: function( term, item, key, value, index, term_re ){
            return value.replace(term_re, "<mark>$1</mark>");
        },
        onSelect: function( evt, term, item, selected, key, value ){ }
    }, options || {});
    
    // custom dynamic properties
    dynamic(self, {
    suggestions: {
        get: function( ){
            return cache[sc._term] || [];
        },
        set: function( v ){
            suggest( v || [] );
        }
    },
    key: {
        get: function( ){
            return item_key;
        },
        set: function( v ){
            item_key = null != v ? v : null;
        }
    },
    value: {
        get: function( ){
            return item_val;
        },
        set: function( v ){
            item_val = null != v ? v : null;
        }
    },
    cache: {
        get: function( ){
            return cache_time;
        },
        set: function( v ){
            cache_time = parseInt(v, 10) || 0;
            if ( cache_time < 0 ) cache_time = 0;
        }
    },
    delay: {
        get: function( ){
            return delay;
        },
        set: function( v ){
            delay = parseInt(v, 10) || 0;
            if ( delay < 0 ) delay = 0;
        }
    },
    minChars: {
        get: function( ){
            return min_chars;
        },
        set: function( v ){
            min_chars = parseInt(v, 10) || 0;
            if ( min_chars < 0 ) min_chars = 0;
        }
    }
    });
    // public dispose method
    self.dispose = function( ) {
        if ( cache_timer ) clearTimeout( cache_timer );
        cache = null; cache_timer = null;
        self.sc = null; self.element = null; self.onSelect = null;
        removeEvent(element, 'blur', blurHandler);
        removeEvent(element, 'focus', focusHandler);
        removeEvent(element, 'keydown', keydownHandler);
        removeEvent(element, 'keyup', keyupHandler);
        instances.splice( instances.indexOf( self ), 1 );
        if ( !instances.length ) removeEvent(window, 'resize', update_instances);
        
        document.body.removeChild( sc );
        if ( autocompleteAttr ) element[SET_ATTR]('autocomplete', autocompleteAttr);
        else element[DEL_ATTR]('autocomplete');
    };
    
    var min_chars = 3, delay = 150, cache_time = 5000,
        item_key = null, item_val = null,
        autocompleteAttr = element[ATTR]('autocomplete'),
        cache = { }, cache_timer = null, cache_refresh = 5*60*1000, last_val = /*element.value ||*/ '',
        // create suggestions container "sc"
        sc = create('div', 'autocomplete-suggestions '+options.menuClass)
    ;
    
    sc._term = ''; sc._empty = true;
    element[SET_ATTR]('autocomplete','off');
    self.element = element; self.sc = sc;
    self.onSelect = options.onSelect;
    self.source = options.source;
    self.cache = options.cache;
    self.delay = options.delay;
    self.minChars = options.minChars;
    self.key = options.key;
    self.value = options.value;
    document.body.appendChild( sc );

    live('autocomplete-suggestion', 'mouseleave', function( evt ){
        var selected = $1('.autocomplete-suggestion.selected', sc);
        if ( selected ) setTimeout(function( ){ removeClass(selected, 'selected'); }, 10);
    }, sc);

    live('autocomplete-suggestion', 'mouseover', function( evt ){
        var selected = this;
        addClass(selected, 'selected');
    }, sc);

    live('autocomplete-suggestion', 'mousedown', function( evt ){
        var selected = this;
        if ( hasClass(selected, 'autocomplete-suggestion') )
        {
            var term = sc._term, item = cache[term][selected._index],
                val = null != item_val ? item[item_val] : item,
                key = null != item_key ? item[item_key] : val
            ;
            element.value = val;
            removeClass(sc, 'visible');
            self.onSelect( evt, term, item, selected, key, val );
        }
        // else outside click
    }, sc);
    
    var refresh_cache = function refresh_cache( ) {
        if ( null == cache ) return;
        if ( cache_time > 0 )
        {
            var q = sc._term, now = NOW(), term;
            for (term in cache)
            {
                if ( q == term || null == cache[term].time ) continue;
                if ( now-cache[term].time >= cache_time ) delete cache[term];
            }
        }
        cache_timer = setTimeout( refresh_cache, cache_refresh );
    };
    
    var blurHandler = function( evt ) {
        var over_sb = 0;
        try { over_sb = $1('.autocomplete-suggestions:hover'); } catch(e){ over_sb = 0; }
        if ( !over_sb )
        {
            last_val = element.value;
            removeClass(sc, 'visible');
            setTimeout(function(){ removeClass(sc, 'visible'); }, 350); // hide suggestions on fast input
        }
        else if ( element !== document.activeElement )
            setTimeout(function(){ element.focus(); }, 10);
    };

    var suggest = function( list ) {
        list = list || [];
        var q = element.value, eq, i, len, re, key, val, item, suggestion;
        cache[ q ] = list; cache[ q ].time = NOW( );
        if ( q.length >= min_chars )
        {
            sc.innerHTML = '';
            eq = esc_html( q );
            if ( list.length )
            {
                // escape special characters
                re = new RegExp("(" + esc_re( eq ).split(' ').join('|') + ")", "gi");
                for (i=0,len=list.length; i<len; i++)
                {
                    item = list[i];
                    val = null != item_val ? item[item_val] : item;
                    key = null != item_key ? item[item_key] : val;
                    suggestion = create('div', 'autocomplete-suggestion', options.renderItem( eq, item, key, esc_html(val), i, re ));
                    suggestion._index = i;
                    sc.appendChild( suggestion );
                }
                sc._empty = false;
            }
            else
            {
                sc.appendChild( create('div', 'autocomplete-no-suggestions', options.noItems.split('{{term}}').join(eq)) );
                sc._empty = true;
            }
            sc._term = q;
            if ( element === document.activeElement ) updateSC( element, sc, 0 );
        }
        else
        {
            removeClass(sc, 'visible');
        }
    };

    var keydownHandler = function( evt ) {
        var key = window.event ? evt.keyCode : evt.which, next, selected;
        // down (40), up (38)
        if ( (40 === key || 38 === key) && !sc._empty )
        {
            selected = $1('.autocomplete-suggestion.selected', sc);
            if ( selected )
            {
                next = (40 === key) ? selected.nextSibling : selected.previousSibling;
                if ( next )
                {
                    removeClass(selected, 'selected');
                    addClass(next, 'selected');
                    element.value = null !== item_val ? cache[sc._term][next._index][item_val] : cache[sc._term][next._index];
                }
                else
                {
                    removeClass(selected, 'selected');
                    element.value = last_val;
                    next = 0;
                }
            }
            else
            {
                // first : last
                next = (40 === key) ? $1('.autocomplete-suggestion', sc) : sc.children[sc.children.length - 1];
                addClass(next, 'selected');
                element.value = null != item_val ? cache[sc._term][next._index][item_val] : cache[sc._term][next._index];
            }
            updateSC( element, sc, 0, next );
            return false;
        }
        // esc
        else if ( 27 === key )
        {
            element.value = last_val;
            removeClass(sc, 'visible');
        }
        // enter
        else if ( 13 === key || 9 === key )
        {
            selected = $1('.autocomplete-suggestion.selected', sc);
            if ( selected && hasClass(sc, 'visible') )
            {
                var term = sc._term, item = cache[term][selected._index],
                    val = null != item_val ? item[item_val] : item,
                    key = null != item_key ? item[item_key] : val;
                element.value = val;
                self.onSelect( e, term, item, selected, key, val );
                setTimeout(function(){ removeClass(sc, 'visible'); }, 10);
            }
        }
    };

    var timer;
    var keyupHandler = function( evt ) {
        var key = window.event ? evt.keyCode : evt.which, val, now;
        if ( !key || (key < 35 || key > 40) && 13 !== key && 27 !== key )
        {
            val = element.value;
            if ( val.length >= min_chars )
            {
                if ( val != last_val )
                {
                    last_val = val;
                    clearTimeout( timer );
                    if ( cache_time > 0 )
                    {
                        now = NOW( );
                        if ( (val in cache) && (cache_time > now-cache[val].time) )
                        {
                            suggest( cache[val] );
                            return;
                        }
                        // no requests if previous suggestions were empty
                        for (var i=1; i<val.length-min_chars; i++)
                        {
                            var part = val.slice(0, val.length-i);
                            if ( (part in cache) && (cache_time > now-cache[part].time) && !cache[part].length )
                            {
                                suggest( [] );
                                return;
                            }
                        }
                    }
                    timer = setTimeout(function(){ self.source( val, suggest ) }, delay);
                }
            }
            else
            {
                last_val = val;
                removeClass(sc, 'visible');
            }
        }
    };

    var focusHandler = function( e ){
        last_val = '\n';
        keyupHandler( e );
    };

    cache_timer = setTimeout( refresh_cache, cache_refresh );
    addEvent(element, 'blur', blurHandler);
    addEvent(element, 'keydown', keydownHandler);
    addEvent(element, 'keyup', keyupHandler);
    addEvent(element, 'focus', focusHandler);
    if ( !instances.length ) addEvent(window, 'resize', update_instances);
    instances.push( self );
}

return autoComplete;
});
