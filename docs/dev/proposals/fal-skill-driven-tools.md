# Fal Skill-Driven Tools

Status: archived.

This proposal described replacing hardcoded Fal tools in a former
`@heswe/agents` package. Those tools and that package no longer exist, so its
current-state analysis and rollout plan are not applicable to Heswe.

If Fal support is added again, start from the current workspace tool and skill
extension points. The useful constraints from the old proposal still apply:

- keep one small executable integration instead of one core tool per endpoint
- keep endpoint recipes in skills
- validate endpoint names and input objects
- bound upload count, download count, file sizes, and total bytes
- use the shared timed and size-limited remote download helper
- return clear provider and validation errors
