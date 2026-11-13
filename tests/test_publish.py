"""Pure checks of publishing safeguards; these tests do not access GitHub."""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / 'tools' / 'publish.py'
spec = importlib.util.spec_from_file_location('publish_jungle_king', path)
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class PublishSafetyTests(unittest.TestCase):
    def setUp(self):
        self.metadata = {'full_name':'anthonywong/jungle-king','private':True}
        self.refs = {'refs/heads/master':'abc','refs/heads/feature/3d-battles':'def'}

    def test_empty_private_destination_is_allowed(self):
        publish.validate_existing(self.metadata, {}, self.refs)

    def test_identical_existing_backup_is_allowed(self):
        publish.validate_existing(self.metadata, self.refs, self.refs)

    def test_public_destination_is_rejected(self):
        with self.assertRaises(RuntimeError):
            publish.validate_existing({**self.metadata,'private':False}, {}, self.refs)

    def test_unexpected_owner_is_rejected(self):
        with self.assertRaises(RuntimeError):
            publish.validate_existing({**self.metadata,'full_name':'other/jungle-king'}, {}, self.refs)

    def test_unknown_remote_branch_is_rejected(self):
        with self.assertRaises(RuntimeError):
            publish.validate_existing(self.metadata, {'refs/heads/main':'abc'}, self.refs)

    def test_changed_remote_commit_is_rejected(self):
        with self.assertRaises(RuntimeError):
            publish.validate_existing(self.metadata, {'refs/heads/master':'changed'}, self.refs)

    def test_dereferenced_tag_does_not_replace_tag_object(self):
        self.assertEqual(publish.parse_refs('aaa\trefs/tags/2d-baseline\nbbb\trefs/tags/2d-baseline^{}\n'),
                         {'refs/tags/2d-baseline':'aaa'})


if __name__ == '__main__':
    unittest.main()
