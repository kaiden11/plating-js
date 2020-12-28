
import { EditorView, keymap} from "@codemirror/next/view"
import { EditorState, EditorStateConfig, StateCommand } from "@codemirror/next/state"
import { basicSetup } from "@codemirror/next/basic-setup"
import { defaultKeymap, indentLess, indentMore } from "@codemirror/next/commands"
import { json } from "@codemirror/next/lang-json"

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


const common_setup_array = [
    basicSetup,
    EditorState.tabSize.of( 4 ),
    EditorState.changeFilter.of(
         (tr) => {

            if( debounce_timer != null ) {
                clearTimeout( debounce_timer );
                debounce_timer = null;
            }

            debounce_timer = setTimeout( 
                () => {
                    renderMustache();
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
                doc: "{\"hello\":\"world\"}",
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
                doc: "{{hello}}",
                extensions: [
                    ...common_setup_array
                ],
            }
        )
    }
);

function renderMustache() {

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
    }
};


let json_view_el = document.body.querySelector( '#json-view' );
let mustache_view_el = document.body.querySelector( '#mustache-view' );
let mustache_output_el = document.body.querySelector( '#mustache-output' );

if( json_view_el ) {
    json_view_el.appendChild(json_view.dom)
}

if( mustache_view_el ) {
    mustache_view_el.appendChild(mustache_view.dom)
}
