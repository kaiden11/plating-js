
import { EditorView, keymap} from "@codemirror/next/view"
import { EditorState, EditorStateConfig, StateCommand } from "@codemirror/next/state"
import { basicSetup } from "@codemirror/next/basic-setup"
import { defaultKeymap, indentLess, indentMore } from "@codemirror/next/commands"
import { json } from "@codemirror/next/lang-json"
import { oneDark } from "@codemirror/next/theme-one-dark"
import * as pako from "pako"
import { Base64 } from "js-base64"
import { BehaviorSubject,  fromEvent, merge } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

import * as Mustache from "mustache"
import { render } from "mustache"

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

let starting_json_content = "{\"hello\":\"world\"} // comments here";
let starting_mustache_content = "{{hello}}";

// Initial load
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

            if( obj != null && obj.j !== 'undefined' && obj.j != null ) {
                starting_json_content = obj.j;
            }

            if( obj != null && obj.m !== 'undefined' && obj.m != null ) {
                starting_mustache_content = obj.m;
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

const json_bs = new BehaviorSubject<string>( starting_json_content );
const mustache_bs = new BehaviorSubject<string>( starting_mustache_content );

let json_view = new EditorView(
    {
        state: EditorState.create(
            {
                doc: starting_json_content,
                extensions: [
                    ...common_setup_array,
                    json(),
                    EditorState.changeFilter.of(
                        (tr) => {

                            if( tr.docChanged ) {
                                json_bs.next(
                                    tr.state.doc.sliceString( 0 )
                                );
                            }

                           return true;
                        }
                   )                    
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
                    ...common_setup_array,
                    EditorState.changeFilter.of(
                         (tr) => {

                            if( tr.docChanged ) {
                                mustache_bs.next(
                                    tr.state.doc.sliceString( 0 )
                                );
                            }

                            return true;
                         }
                    )
                ],
            }
        )
    }
);

function updateContentFromHashIfNecessary() {
    
    if( window.location.hash != null && window.location.hash ) {
        var hash = window.location.hash;
    
        try {
    
            var u8 = Base64.toUint8Array( hash );
    
            var inflated = pako.inflate( u8 );
    
            if( inflated != null && inflated ) {
                let utf8decoder = new TextDecoder()
    
                var json_str = utf8decoder.decode( inflated );
    
                let obj = JSON.parse( json_str );
       
                if( obj != null && obj.j !== 'undefined' && obj.j != null ) {
                    let json_content = <string> obj.j;

                    if( json_content != json_view.state.doc.sliceString( 0 ) ) {
                        // Hash content differs, update the view
                        // console.log( 'updating json view' );

                        json_view.dispatch(
                            json_view.state.update(
                                {
                                    changes: {
                                        from: 0,
                                        to: json_view.state.doc.length,
                                        insert: json_content
                                    }
                                }
                            )
                        );
                    }
                }
    
                if( obj != null && obj.m !== 'undefined' && obj.m != null ) {
                    let mustache_content = <string> obj.m;

                    if( mustache_content != mustache_view.state.doc.sliceString( 0 ) ) {
                        // Hash content differs, update the view
                        // console.log( 'updating mustache view' );

                        mustache_view.dispatch(
                            mustache_view.state.update(
                                {
                                    changes: {
                                        from: 0,
                                        to: mustache_view.state.doc.length,
                                        insert: mustache_content
                                    }
                                }
                            )
                        );
                    }
                }
                
            }
    
        } catch( err ) {
            console.log( err );
        }
    }
}


let is_typing = false;

// Consider ourselves 'typing' if we've seen
// a document change / transaction in the last
// 1000ms
merge( json_bs, mustache_bs )
    .subscribe( () => { is_typing = true })

merge( json_bs, mustache_bs )
    .pipe( debounceTime( 1000 ) )
    .subscribe( () => { is_typing = false })

// Render any mustache changes after 250ms
// of no activity.
merge(
    json_bs,
    mustache_bs
).pipe(
    debounceTime( 250 )
).subscribe(
    (_) => {
        renderMustache();
    }
);

// Update the hash after 250ms of inactivity
merge(
    json_bs,
    mustache_bs
).pipe( 
    debounceTime( 250 )
)
.subscribe(
    (_) => {
        updateHash();
    }
);

const popstate_event = fromEvent( window, 'popstate' );

// Detect pop state, but filter if we see that we've been
// typing in the last 1000ms (is_typing).
popstate_event.pipe(
    filter( () => !is_typing ),
    debounceTime( 250 )
).subscribe(
    (_) => {
        // console.log( 'popped state!');
        updateContentFromHashIfNecessary();
    }
)

const SLASH_SLASH_COMMENTS = /[\/]{2}.*$/mg;
const SLASH_START_COMMENTS = /\/\*.*?\*\//mgs;

function stripJsonComments( json: string ) {
    json = json.replace( SLASH_START_COMMENTS, '' );    
    json = json.replace( SLASH_SLASH_COMMENTS, '' );
    console.log( json );
    return json;
}

function updateHash() {

    let err_array : String[] = [];

    if( json_view && mustache_view ) {

        var payload = {
            j: json_view.state.doc.sliceString( 0 ),
            m: mustache_view.state.doc.sliceString( 0 )
        }

        var stringified = JSON.stringify( payload );

        var deflated = pako.deflate( stringified );

        var encoded = Base64.fromUint8Array( deflated );

        window.location.hash = encoded;
    }
}

function renderMustache() {

    let err_array : String[] = [];

    if( json_view && mustache_view ) {

        let obj : object = null;
        try {
            obj = JSON.parse(
                stripJsonComments(
                    json_view.state.doc.sliceString( 0 )
                )
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
                if( mustache_template.trim() == "" ) {
                    output = stripJsonComments( JSON.stringify( obj, null, 2 ) );
                } else {
                    output = Mustache.render( mustache_template, obj );
                }
                
            } catch( err ) {
                err_array.push( err );
            }
        }

        if( err_array.length <= 0 && output ) {

            mustache_output_el.innerHTML = '';
            mustache_output_el.innerHTML = output;

        } else {

            mustache_output_el.innerHTML = '';
            mustache_output_el.innerHTML = err_array.join( '\n');
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
        renderMustache();
    },
    10
);
