
import { EditorView, keymap} from "@codemirror/next/view"
import { EditorState, EditorStateConfig, StateCommand } from "@codemirror/next/state"
import { basicSetup } from "@codemirror/next/basic-setup"
import { defaultKeymap, indentLess, indentMore } from "@codemirror/next/commands"
import { json } from "@codemirror/next/lang-json"
import { oneDark } from "@codemirror/next/theme-one-dark"
import * as pako from "pako"
import { Base64 } from "js-base64"

import * as Mustache from "mustache"

export const insertTab: StateCommand = ({state, dispatch}) => {

    let line = state.doc.lineAt( state.selection.primary.from );
    let col = state.selection.primary.from - line.from;
    let spaces_to_insert = " ".repeat( state.tabSize - ( col % state.tabSize ) );

    dispatch(
        state.update( 
            state.replaceSelection( spaces_to_insert )
        )
    );

    return true;
}

let debounce_timer: NodeJS.Timeout = null;

let starting_json_content = "{\"hello\":\"world\"}";
let starting_mustache_content = "{{hello}}";

if( window.location.hash != null && window.location.hash ) {
    var hash = window.location.hash;

    try {

        var u8 = Base64.toUint8Array( hash );

        var inflated = pako.inflate( u8 );

        if( inflated != null && inflated ) {
            let utf8decoder = new TextDecoder()

            var json_str = utf8decoder.decode( inflated );

            let obj = JSON.parse( json_str );

            console.log( obj );

            if( obj != null && obj.json !== 'undefined' && obj.json != null ) {
                starting_json_content = obj.json;
            }

            if( obj != null && obj.mustache !== 'undefined' && obj.mustache != null ) {
                starting_mustache_content = obj.mustache;
            }
            
        }

    } catch( err ) {
        console.log( err );
    }
}


const common_setup_array = [
    basicSetup,
    oneDark,
    EditorState.tabSize.of( 4 ),
    EditorState.changeFilter.of(
         (tr) => {

            if( debounce_timer != null ) {
                clearTimeout( debounce_timer );
                debounce_timer = null;
            }

            debounce_timer = setTimeout( 
                () => {
                    updateHashAndRenderMustache();
                    clearTimeout( debounce_timer );
                    debounce_timer = null;
                },
                250
            );

            return true;
         }
    ),
    keymap( 
        [
            ...defaultKeymap,
            {
                key: "Ctrl-]",
                preventDefault: true,
                run: indentMore,
            },
            {
                key: "Ctrl-[",
                preventDefault: true,
                run: indentLess,
            },
            {
                key: "Tab",
                preventDefault: true,
                run: insertTab,
            }

        ]
    )
];


let json_view = new EditorView(
    {
        state: EditorState.create(
            {
                doc: starting_json_content,
                extensions: [
                    ...common_setup_array,
                    json()
                ]
            }
        )
    }
);

let mustache_view = new EditorView(
    {
        state: EditorState.create(
            {
                doc: starting_mustache_content,
                extensions: [
                    ...common_setup_array
                ],
            }
        )
    }
);

function updateHashAndRenderMustache() {

    let err_array : String[] = [];

    if( json_view && mustache_view ) {

        let obj : object = null;
        try {
            obj = JSON.parse(
                json_view.state.doc.sliceString( 0 ) 
            );
        } catch( err ) {
            err_array.push( err );
        }

        let mustache_template : string = null;
        try {

            mustache_template = mustache_view.state.doc.sliceString( 0 );

        } catch( err ) {
            err_array.push( err );
        }

        let output : string = null;
        if( err_array.length <= 0 && obj != null && mustache_template != null ) {

            try {
                output = Mustache.render( mustache_template, obj );
            } catch( err ) {
                err_array.push( err );
            }
        }

        if( err_array.length <= 0 && output ) {

            mustache_output_el.innerHTML = '';
            let new_pre = document.createElement( 'pre' );
            new_pre.innerText = output;
        
            mustache_output_el.appendChild( new_pre );

        } else {

            mustache_output_el.innerHTML = '';
            let new_pre = document.createElement( 'pre' );
            new_pre.innerText = err_array.join( '\n');
            mustache_output_el.appendChild( new_pre );
        }

        if( err_array.length <= 0 && obj != null && mustache_template != null ) {
            var payload = {
                json: json_view.state.doc.sliceString( 0 ),
                mustache: mustache_template
            }

            var stringified = JSON.stringify( payload );

            var deflated = pako.deflate( stringified );

            var encoded = Base64.fromUint8Array( deflated );

            window.location.hash = encoded;
        }
    }

    title_el.innerHTML = '';
    title_el.innerText = `${window.location.toString().length} out of 2000`
};



let json_view_el = document.body.querySelector( '#json-view' );
let mustache_view_el = document.body.querySelector( '#mustache-view' );
let mustache_output_el = document.body.querySelector( '#mustache-output' );

let title_el = document.head.querySelector( 'title' );

if( json_view_el ) {
    json_view_el.appendChild(json_view.dom)
}

if( mustache_view_el ) {
    mustache_view_el.appendChild(mustache_view.dom)
}

setTimeout(
    () => {
        updateHashAndRenderMustache();
    },
    10
);
