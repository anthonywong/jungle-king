#!/usr/bin/env python3
"""Serve the built Jungle King game on loopback. No installation or publication."""
import argparse
import functools
import http.server
import pathlib
import webbrowser


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Open the 3D runtime check page, when included')
    parser.add_argument('--no-open',action='store_true',help='Print URL without opening a browser')
    args=parser.parse_args()
    root=pathlib.Path(__file__).resolve().parent
    if not (root/'index.html').is_file():
        root=root/'dist'
    if not (root/'index.html').is_file():
        raise SystemExit('Build first: python3 build.py')
    page='runtime-check.html' if args.check else 'index.html'
    if not (root/page).is_file():
        raise SystemExit('The selected branch does not include the 3D runtime-check page.')
    class Handler(http.server.SimpleHTTPRequestHandler):
        extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,
                        '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
                        '.mjs':'text/javascript; charset=utf-8','.glb':'model/gltf-binary'}
        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            super().end_headers()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
    url=f'http://127.0.0.1:{server.server_port}/'+page
    print('Jungle King:',url,flush=True)
    if (root/'battle.html').is_file():
        print('The model/media are bundled. Real-time 3D still requires the pinned engine downloads.',flush=True)
    print('Ctrl+C stops this local server.',flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__=='__main__':
    main()
