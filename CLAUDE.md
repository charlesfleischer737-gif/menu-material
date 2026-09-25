# Menu Material

## Shipping changes

The owner always wants finished work merged to `main`. Open a pull request and merge it yourself; don't stop at an open pull request or wait for a review.

1. Work on your `claude/...` branch. If `main` has moved, merge it into the branch rather than rebasing.
2. Before merging, run `npm run typecheck`, `npm test` and `npm run build`, and fix anything the change breaks.
3. Open the pull request against `main`, then merge it with a merge commit titled `<pull request title> (#<number>)`.
