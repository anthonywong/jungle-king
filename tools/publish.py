#!/usr/bin/env python3
"""Explicitly publish the two prepared branches to a NEW PRIVATE GitHub repository.

Requires GitHub CLI authentication on the user's computer. No token is accepted
or stored by this script. There is no force-push, website deployment or public
visibility change. Existing repositories are accepted only when empty or when
all of their branch/tag refs already match this prepared backup.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'anthonywong'
REPO = OWNER + '/jungle-king'
URL = 'https://github.com/' + REPO + '.git'
REFS = ('refs/heads/master', 'refs/heads/feature/3d-battles',
        'refs/tags/2d-baseline', 'refs/tags/3d-elephant-preview')


def run(args, *, check=True):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(args)}\n{result.stderr.strip()}")
    return result


def git(*args, auth=False, check=True):
    # Per-command credential helper: do not modify the user's global Git config.
    prefix = ['git']
    if auth:
        prefix += ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential']
    return run(prefix + list(args), check=check)


def parse_refs(text):
    refs = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        sha, ref = line.split(None, 1)
        if ref.endswith('^{}'):
            continue
        refs[ref] = sha
    return refs


def validate_existing(metadata, remote_refs, local_refs):
    if metadata.get('full_name', '').lower() != REPO.lower():
        raise RuntimeError('GitHub returned a different repository; refusing to continue.')
    if metadata.get('private') is not True:
        raise RuntimeError('The destination is not private. No visibility change or upload was made.')
    if any(ref not in local_refs or local_refs[ref] != sha for ref, sha in remote_refs.items()):
        raise RuntimeError('The existing repository contains different work. Refusing to overwrite or force-push.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='Check the local repository and print the plan; no GitHub access')
    args = parser.parse_args()
    if not shutil.which('git'):
        raise RuntimeError('Git is required.')
    top = Path(git('rev-parse', '--show-toplevel').stdout.strip()).resolve()
    if top != ROOT.resolve():
        raise RuntimeError('Run this helper from the prepared Jungle King repository.')
    if git('status', '--porcelain').stdout.strip():
        raise RuntimeError('Commit or stash local changes before publishing the prepared checkpoints.')
    local_refs = {ref:git('rev-parse', '--verify', ref).stdout.strip() for ref in REFS}
    origin = git('remote', 'get-url', 'origin', check=False)
    original_remote = origin.stdout.strip() if origin.returncode == 0 else None
    allowed = {URL, URL[:-4], 'git@github.com:' + REPO + '.git'}
    bundle_origin = bool(original_remote and original_remote.endswith('.bundle') and Path(original_remote).is_file())
    if original_remote and original_remote not in allowed and not bundle_origin:
        raise RuntimeError('origin points to a different destination; it has not been changed.')
    print('Destination:', REPO, '(private)')
    print('Default branch: master; 3D branch: feature/3d-battles')
    print('Tags: 2d-baseline, 3d-elephant-preview. No deployment or force-push.')
    if args.dry_run:
        print('Dry run complete. Nothing was sent to GitHub.')
        return
    if not shutil.which('gh'):
        raise RuntimeError('GitHub CLI (gh) is required. Install it, then run: gh auth login')
    login = run(['gh', 'api', 'user', '--jq', '.login']).stdout.strip()
    if login != OWNER:
        raise RuntimeError(f'Authenticated GitHub account is {login!r}; expected {OWNER!r}. No repository was created.')
    probe = run(['gh', 'api', 'repos/' + REPO], check=False)
    if probe.returncode:
        if 'HTTP 404' not in probe.stderr:
            raise RuntimeError('Could not inspect the destination. No repository was created.\n' + probe.stderr.strip())
        run(['gh', 'repo', 'create', REPO, '--private', '--description',
             'Jungle King — painted animal chess on master; real-time 3D battle development on a separate branch.'])
        metadata = json.loads(run(['gh', 'api', 'repos/' + REPO]).stdout)
    else:
        metadata = json.loads(probe.stdout)
    remote_refs = parse_refs(git('ls-remote', '--heads', '--tags', URL, auth=True).stdout)
    validate_existing(metadata, remote_refs, local_refs)
    if bundle_origin:
        if git('remote', 'get-url', 'source-bundle', check=False).returncode == 0:
            raise RuntimeError('source-bundle remote already exists; preserve/rename the archive remote manually.')
        git('remote', 'rename', 'origin', 'source-bundle')
        original_remote = None
    if original_remote is None:
        git('remote', 'add', 'origin', URL)
    # Explicit refs only. A non-fast-forward or non-atomic server fails safely.
    git('push', '--atomic', 'origin', *(ref + ':' + ref for ref in REFS), auth=True)
    run(['gh', 'repo', 'edit', REPO, '--default-branch', 'master'])
    verified = parse_refs(git('ls-remote', '--heads', '--tags', URL, auth=True).stdout)
    metadata = json.loads(run(['gh', 'api', 'repos/' + REPO]).stdout)
    validate_existing(metadata, verified, local_refs)
    if any(verified.get(ref) != sha for ref, sha in local_refs.items()):
        raise RuntimeError('Remote ref verification did not match the local checkpoints.')
    if metadata.get('default_branch') != 'master':
        raise RuntimeError('Pushed refs verified, but the default branch is not master.')
    print('Verified private repository:', metadata['html_url'])
    for ref, sha in local_refs.items():
        print(ref, sha)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError) as exc:
        print('Publish stopped:', exc, file=sys.stderr)
        sys.exit(1)
