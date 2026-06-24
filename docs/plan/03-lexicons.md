# ATProto Lexicon Records

All governance metadata is defined as custom ATProto Lexicons under the `sh.tangled.governance` namespace. These records live on users' PDSs — they are signed, portable, and tamper-evident.

## Namespace Structure

```
sh.tangled.governance.
├── org.                    # Organization structure
│   ├── organization
│   ├── membership
│   ├── team
│   └── role
├── compliance.             # Compliance & assessments
│   ├── repoProfile
│   ├── codeOwner
│   ├── incident
│   ├── slaTracker
│   ├── prAssessment
│   ├── controlEvaluation
│   ├── requiredApproval
│   ├── mergeGate
│   ├── impactAssessment
│   └── propagation
├── policy.                 # Policy definitions
│   ├── policyPack
│   ├── control
│   ├── repoBinding
│   └── slaRule
├── graph.                  # Dependency graph
│   ├── repoDependency
│   ├── serviceDependency
│   └── codeDependency
└── audit.                  # Audit trail
    ├── evidence
    ├── agentRun
    └── waiver
```

---

## Organization & Structure

### `governance.org.organization`

Top-level organization entity.

```json
{
  "id": "sh.tangled.governance.org.organization",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["name", "ownerDid", "createdAt"],
        "properties": {
          "name":         { "type": "string", "maxLength": 100 },
          "displayName":  { "type": "string", "maxLength": 200 },
          "description":  { "type": "string", "maxLength": 2000 },
          "ownerDid":     { "type": "string", "format": "did" },
          "avatarUrl":    { "type": "string", "format": "uri" },
          "settings": {
            "type": "object",
            "properties": {
              "defaultEnforcement": { "type": "string", "knownValues": ["advisory", "soft", "hard"] },
              "requireComplianceProfile": { "type": "boolean" }
            }
          },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.org.membership`

Links a person (DID) to an organization with a role.

```json
{
  "id": "sh.tangled.governance.org.membership",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["org", "memberDid", "role", "createdAt"],
        "properties": {
          "org":        { "type": "string", "format": "at-uri" },
          "memberDid":  { "type": "string", "format": "did" },
          "role":       { "type": "string", "format": "at-uri", "description": "AT-URI of the role record" },
          "teams":      { "type": "array", "items": { "type": "string", "format": "at-uri" } },
          "invitedBy":  { "type": "string", "format": "did" },
          "createdAt":  { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.org.team`

Named group within an organization.

```json
{
  "id": "sh.tangled.governance.org.team",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["org", "name", "createdAt"],
        "properties": {
          "org":          { "type": "string", "format": "at-uri" },
          "name":         { "type": "string", "maxLength": 100 },
          "displayName":  { "type": "string", "maxLength": 200 },
          "description":  { "type": "string", "maxLength": 1000 },
          "leadDid":      { "type": "string", "format": "did" },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.org.role`

Role definition with permission set.

```json
{
  "id": "sh.tangled.governance.org.role",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["org", "slug", "name", "permissions"],
        "properties": {
          "org":          { "type": "string", "format": "at-uri" },
          "slug":         { "type": "string", "maxLength": 50,
                           "knownValues": ["org-admin", "repo-admin", "policy-author",
                                           "auditor", "contributor", "isms-manager",
                                           "dpo", "security-lead"] },
          "name":         { "type": "string", "maxLength": 100 },
          "description":  { "type": "string", "maxLength": 500 },
          "permissions":  {
            "type": "array",
            "items": { "type": "string",
                       "knownValues": ["org.manage", "org.invite", "repo.create",
                                       "repo.delete", "policy.author", "policy.bind",
                                       "compliance.approve", "compliance.waive",
                                       "audit.view", "audit.export"] }
          }
        }
      }
    }
  }
}
```

---

## Compliance & Assessments

### `governance.compliance.repoProfile`

Governance metadata for a specific repository.

```json
{
  "id": "sh.tangled.governance.compliance.repoProfile",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["org", "repo", "dataClassification", "createdAt"],
        "properties": {
          "org":                 { "type": "string", "format": "at-uri" },
          "repo":                { "type": "string", "format": "at-uri" },
          "dataClassification":  { "type": "string",
                                   "knownValues": ["public", "internal", "confidential", "restricted"] },
          "handlesData":         { "type": "array",
                                   "items": { "type": "string",
                                              "knownValues": ["pii", "phi", "financial", "credentials",
                                                              "ml-training-data", "public-data"] } },
          "applicableRegulations": { "type": "array",
                                     "items": { "type": "string",
                                                "knownValues": ["iso-27001", "gdpr", "eu-ai-act",
                                                                "soc2", "hipaa", "pci-dss", "custom"] } },
          "riskTier":            { "type": "string", "knownValues": ["critical", "high", "medium", "low"] },
          "enforcementMode":     { "type": "string", "knownValues": ["advisory", "soft", "hard"] },
          "description":         { "type": "string", "maxLength": 2000 },
          "createdAt":           { "type": "string", "format": "datetime" },
          "updatedAt":           { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.codeOwner`

Maps file patterns to responsible teams or individuals.

```json
{
  "id": "sh.tangled.governance.compliance.codeOwner",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["repo", "pattern", "createdAt"],
        "properties": {
          "repo":       { "type": "string", "format": "at-uri" },
          "pattern":    { "type": "string", "description": "Glob pattern, e.g. 'api/**', 'models/patient*.go'" },
          "ownerDid":   { "type": "string", "format": "did", "description": "Individual owner (optional)" },
          "ownerTeam":  { "type": "string", "format": "at-uri", "description": "Team owner (optional)" },
          "approvalRequired": { "type": "boolean", "default": true },
          "description": { "type": "string", "maxLength": 500 },
          "createdAt":  { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.incident`

Security incident classification linked to a Tangled issue.

```json
{
  "id": "sh.tangled.governance.compliance.incident",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["issue", "repo", "severity", "category", "createdAt"],
        "properties": {
          "issue":           { "type": "string", "format": "at-uri", "description": "AT-URI of the sh.tangled.issue" },
          "repo":            { "type": "string", "format": "at-uri" },
          "org":             { "type": "string", "format": "at-uri" },
          "severity":        { "type": "string", "knownValues": ["critical", "high", "medium", "low"] },
          "category":        { "type": "string",
                               "knownValues": ["data-leak", "vulnerability", "unauthorized-access",
                                               "supply-chain", "misconfiguration", "other"] },
          "affectedPackage": { "type": "string", "description": "Package name + version" },
          "cveIds":          { "type": "array", "items": { "type": "string" } },
          "description":     { "type": "string", "maxLength": 5000 },
          "linkedPR":        { "type": "string", "format": "at-uri", "description": "PR that fixes this incident" },
          "status":          { "type": "string", "knownValues": ["open", "in-progress", "resolved", "closed"] },
          "createdAt":       { "type": "string", "format": "datetime" },
          "resolvedAt":      { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.slaTracker`

Tracks SLA deadline and status for a specific incident.

```json
{
  "id": "sh.tangled.governance.compliance.slaTracker",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["incident", "slaRule", "deadline", "status"],
        "properties": {
          "incident":   { "type": "string", "format": "at-uri" },
          "slaRule":    { "type": "string", "format": "at-uri" },
          "deadline":   { "type": "string", "format": "datetime" },
          "status":     { "type": "string", "knownValues": ["open", "at-risk", "breached", "resolved"] },
          "resolvedAt": { "type": "string", "format": "datetime" },
          "resolvedBy": { "type": "string", "format": "did" },
          "breachedAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.prAssessment`

Overall risk assessment for a pull request.

```json
{
  "id": "sh.tangled.governance.compliance.prAssessment",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["pullRequest", "repo", "riskLevel", "summary", "createdAt"],
        "properties": {
          "pullRequest":     { "type": "string", "format": "at-uri" },
          "repo":            { "type": "string", "format": "at-uri" },
          "incident":        { "type": "string", "format": "at-uri", "description": "Linked incident if this PR is a fix" },
          "riskLevel":       { "type": "string", "knownValues": ["critical", "high", "medium", "low", "none"] },
          "summary":         { "type": "string", "maxLength": 5000, "description": "Claude's assessment summary" },
          "changedFiles":    { "type": "integer" },
          "affectedOwners":  { "type": "array", "items": { "type": "string", "format": "did" } },
          "affectedTeams":   { "type": "array", "items": { "type": "string", "format": "at-uri" } },
          "controlsPassed":  { "type": "integer" },
          "controlsFailed":  { "type": "integer" },
          "controlsWarning": { "type": "integer" },
          "agentRun":        { "type": "string", "format": "at-uri" },
          "createdAt":       { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.controlEvaluation`

Per-control pass/fail result for a PR.

```json
{
  "id": "sh.tangled.governance.compliance.controlEvaluation",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["prAssessment", "control", "status", "createdAt"],
        "properties": {
          "prAssessment": { "type": "string", "format": "at-uri" },
          "control":      { "type": "string", "format": "at-uri" },
          "status":       { "type": "string", "knownValues": ["pass", "fail", "warning", "skipped"] },
          "reason":       { "type": "string", "maxLength": 2000 },
          "evidence":     { "type": "array", "items": { "type": "string", "format": "at-uri" } },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.requiredApproval`

Specifies who must approve a PR and why. Supports both DID-based and role-based requirements.

```json
{
  "id": "sh.tangled.governance.compliance.requiredApproval",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["prAssessment", "reason", "status", "createdAt"],
        "properties": {
          "prAssessment": { "type": "string", "format": "at-uri" },
          "approverDid":  { "type": "string", "format": "did", "description": "Specific person (use one of approverDid or approverRole)" },
          "approverRole": { "type": "string", "description": "Role slug, e.g. 'isms-manager'. Any org member with this role can satisfy it" },
          "approverTeam": { "type": "string", "format": "at-uri", "description": "Any member of this team can satisfy it" },
          "reason":       { "type": "string", "maxLength": 1000 },
          "policyRef":    { "type": "string", "format": "at-uri", "description": "The control that requires this" },
          "status":       { "type": "string", "knownValues": ["pending", "approved", "rejected"] },
          "approvedBy":   { "type": "string", "format": "did" },
          "approvedAt":   { "type": "string", "format": "datetime" },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.compliance.mergeGate`

Final merge verdict for a PR.

```json
{
  "id": "sh.tangled.governance.compliance.mergeGate",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["pullRequest", "prAssessment", "status", "createdAt"],
        "properties": {
          "pullRequest":   { "type": "string", "format": "at-uri" },
          "prAssessment":  { "type": "string", "format": "at-uri" },
          "status":        { "type": "string", "knownValues": ["pass", "warning", "needs-human-review", "blocked"] },
          "reason":        { "type": "string", "maxLength": 2000 },
          "blockedControls": { "type": "array", "items": { "type": "string", "format": "at-uri" } },
          "pendingApprovals": { "type": "array", "items": { "type": "string", "format": "at-uri" } },
          "postMergeActions": {
            "type": "array",
            "items": { "type": "ref", "ref": "#postMergeAction" }
          },
          "createdAt":     { "type": "string", "format": "datetime" }
        }
      }
    },
    "postMergeAction": {
      "type": "object",
      "required": ["action"],
      "properties": {
        "action":      { "type": "string", "knownValues": ["propagate-issues", "notify-owners", "trigger-scan", "update-sla"] },
        "targetRepos": { "type": "array", "items": { "type": "string", "format": "at-uri" } },
        "reason":      { "type": "string", "maxLength": 500 }
      }
    }
  }
}
```

### `governance.compliance.impactAssessment`

Downstream impact analysis based on dependency graph traversal.

```json
{
  "id": "sh.tangled.governance.compliance.impactAssessment",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["pullRequest", "repo", "affectedEdges", "riskLevel", "createdAt"],
        "properties": {
          "pullRequest":  { "type": "string", "format": "at-uri" },
          "repo":         { "type": "string", "format": "at-uri" },
          "affectedEdges": {
            "type": "array",
            "items": { "type": "ref", "ref": "#affectedEdge" }
          },
          "riskLevel":    { "type": "string", "knownValues": ["none", "low", "medium", "high", "critical"] },
          "summary":      { "type": "string", "maxLength": 3000, "description": "Claude's impact summary" },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    },
    "affectedEdge": {
      "type": "object",
      "required": ["codeDependency", "downstreamRepo", "reason"],
      "properties": {
        "codeDependency": { "type": "string", "format": "at-uri" },
        "downstreamRepo": { "type": "string", "format": "at-uri" },
        "downstreamPath": { "type": "string" },
        "reason":         { "type": "string", "maxLength": 500 },
        "actionRequired": { "type": "string", "knownValues": ["update-required", "review-recommended", "no-action"] }
      }
    }
  }
}
```

### `governance.compliance.propagation`

Record of auto-created downstream issues after a merge.

```json
{
  "id": "sh.tangled.governance.compliance.propagation",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["sourcePR", "sourceRepo", "downstreamActions", "createdAt"],
        "properties": {
          "sourcePR":    { "type": "string", "format": "at-uri" },
          "sourceRepo":  { "type": "string", "format": "at-uri" },
          "incident":    { "type": "string", "format": "at-uri" },
          "downstreamActions": {
            "type": "array",
            "items": { "type": "ref", "ref": "#downstreamAction" }
          },
          "createdAt":   { "type": "string", "format": "datetime" }
        }
      }
    },
    "downstreamAction": {
      "type": "object",
      "required": ["repo", "issue", "reason", "codeDependency"],
      "properties": {
        "repo":           { "type": "string", "format": "at-uri" },
        "issue":          { "type": "string", "format": "at-uri", "description": "Auto-created issue in downstream repo" },
        "codeDependency": { "type": "string", "format": "at-uri", "description": "The edge that caused this" },
        "reason":         { "type": "string", "maxLength": 1000 },
        "severity":       { "type": "string", "knownValues": ["critical", "high", "medium", "low"] }
      }
    }
  }
}
```

---

## Policy Definitions

### `governance.policy.policyPack`

Named bundle of controls (e.g., "ISO 27001 Base", "GDPR Data Pack").

```json
{
  "id": "sh.tangled.governance.policy.policyPack",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["org", "name", "version", "createdAt"],
        "properties": {
          "org":          { "type": "string", "format": "at-uri" },
          "name":         { "type": "string", "maxLength": 100 },
          "displayName":  { "type": "string", "maxLength": 200 },
          "description":  { "type": "string", "maxLength": 2000 },
          "framework":    { "type": "string",
                           "knownValues": ["iso-27001", "gdpr", "eu-ai-act", "soc2", "hipaa", "pci-dss", "custom"] },
          "version":      { "type": "string", "maxLength": 20 },
          "isStarter":    { "type": "boolean", "description": "True if this is a built-in starter pack" },
          "createdAt":    { "type": "string", "format": "datetime" },
          "updatedAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.policy.control`

Single enforceable rule within a policy pack.

```json
{
  "id": "sh.tangled.governance.policy.control",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["policyPack", "controlId", "name", "checkType", "enforcement"],
        "properties": {
          "policyPack":    { "type": "string", "format": "at-uri" },
          "controlId":     { "type": "string", "maxLength": 20, "description": "e.g. 'ACCESS-2', 'VULN-1'" },
          "name":          { "type": "string", "maxLength": 200 },
          "description":   { "type": "string", "maxLength": 2000 },
          "isoReference":  { "type": "string", "description": "e.g. 'A.8.25' for ISO 27001" },
          "checkType":     { "type": "string",
                            "knownValues": ["gate", "scan", "organizational", "approval", "system"] },
          "enforcement":   { "type": "string", "knownValues": ["hard", "soft", "advisory"] },
          "scanTool":      { "type": "string",
                            "knownValues": ["semgrep", "gitleaks", "osv-scanner", "custom"],
                            "description": "Which scan tool checks this (if checkType is scan)" },
          "requiredApproverRole": { "type": "string", "description": "Role that must approve (if checkType is approval)" },
          "severityThreshold":    { "type": "string", "knownValues": ["critical", "high", "medium", "low"],
                                   "description": "Minimum finding severity to trigger (if scan-based)" },
          "autoRemediation":      { "type": "string", "description": "Suggested fix action" }
        }
      }
    }
  }
}
```

### `governance.policy.repoBinding`

Binds a policy pack to a specific repository.

```json
{
  "id": "sh.tangled.governance.policy.repoBinding",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["repo", "policyPack", "createdAt"],
        "properties": {
          "repo":            { "type": "string", "format": "at-uri" },
          "policyPack":      { "type": "string", "format": "at-uri" },
          "enforcementOverride": { "type": "string", "knownValues": ["advisory", "soft", "hard"],
                                   "description": "Override the pack's default enforcement for this repo" },
          "enabledControls": { "type": "array", "items": { "type": "string", "format": "at-uri" },
                              "description": "If set, only these controls are active (subset of pack)" },
          "disabledControls": { "type": "array", "items": { "type": "string", "format": "at-uri" },
                               "description": "Controls to skip for this repo" },
          "boundBy":         { "type": "string", "format": "did" },
          "createdAt":       { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.policy.slaRule`

SLA time-based requirements per severity level.

```json
{
  "id": "sh.tangled.governance.policy.slaRule",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["policyPack", "severity", "maxResolutionHours"],
        "properties": {
          "policyPack":           { "type": "string", "format": "at-uri" },
          "severity":             { "type": "string", "knownValues": ["critical", "high", "medium", "low"] },
          "maxResolutionHours":   { "type": "integer", "description": "e.g. 48 for critical" },
          "requiredApproverRole": { "type": "string", "description": "Role that must approve resolution" },
          "escalationAfterHours": { "type": "integer", "description": "Auto-escalate if unresolved" },
          "escalationTarget":     { "type": "string", "description": "Role to escalate to" }
        }
      }
    }
  }
}
```

---

## Dependency Graph

### `governance.graph.repoDependency`

Repo-level dependency (coarse-grained).

```json
{
  "id": "sh.tangled.governance.graph.repoDependency",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["sourceRepo", "targetRepo", "dependencyType", "createdAt"],
        "properties": {
          "sourceRepo":     { "type": "string", "format": "at-uri" },
          "targetRepo":     { "type": "string", "format": "at-uri" },
          "dependencyType": { "type": "string", "knownValues": ["runtime", "build", "test", "api", "data"] },
          "description":    { "type": "string", "maxLength": 500 },
          "createdAt":      { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.graph.serviceDependency`

Dependency on an external service.

```json
{
  "id": "sh.tangled.governance.graph.serviceDependency",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["repo", "serviceName", "createdAt"],
        "properties": {
          "repo":         { "type": "string", "format": "at-uri" },
          "serviceName":  { "type": "string", "maxLength": 200 },
          "serviceUrl":   { "type": "string", "format": "uri" },
          "serviceType":  { "type": "string", "knownValues": ["database", "api", "queue", "cache", "storage", "auth", "other"] },
          "description":  { "type": "string", "maxLength": 500 },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.graph.codeDependency`

Fine-grained dependency edge between code units across repos.

```json
{
  "id": "sh.tangled.governance.graph.codeDependency",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["sourceRepo", "sourcePath", "targetRepo", "targetPath", "dependencyType", "createdAt"],
        "properties": {
          "sourceRepo":     { "type": "string", "format": "at-uri" },
          "sourcePath":     { "type": "string", "description": "e.g. 'services/billing/client.go'" },
          "sourceLabel":    { "type": "string", "description": "e.g. 'billing-service'" },
          "targetRepo":     { "type": "string", "format": "at-uri" },
          "targetPath":     { "type": "string", "description": "e.g. 'api/patients/handler.go'" },
          "targetLabel":    { "type": "string", "description": "e.g. 'patient-api'" },
          "dependencyType": { "type": "string",
                             "knownValues": ["api-call", "import", "shared-model", "event-consumer",
                                             "database-shared", "config-ref", "grpc", "graphql"] },
          "description":    { "type": "string", "maxLength": 500 },
          "createdAt":      { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

---

## Audit Trail

### `governance.audit.evidence`

Attached proof: scan results, screenshots, logs.

```json
{
  "id": "sh.tangled.governance.audit.evidence",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["prAssessment", "evidenceType", "createdAt"],
        "properties": {
          "prAssessment": { "type": "string", "format": "at-uri" },
          "evidenceType": { "type": "string",
                           "knownValues": ["semgrep-report", "gitleaks-report", "osv-report",
                                           "claude-reasoning", "manual-review", "screenshot", "log"] },
          "title":        { "type": "string", "maxLength": 200 },
          "summary":      { "type": "string", "maxLength": 2000 },
          "content":      { "type": "string", "maxLength": 50000, "description": "Full content (JSON report, reasoning text, etc.)" },
          "findingsCount": { "type": "integer" },
          "blobRef":      { "type": "blob", "description": "Binary attachment if content is too large" },
          "createdAt":    { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.audit.agentRun`

Record of a compliance agent execution.

```json
{
  "id": "sh.tangled.governance.audit.agentRun",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["pullRequest", "repo", "status", "startedAt"],
        "properties": {
          "pullRequest":   { "type": "string", "format": "at-uri" },
          "repo":          { "type": "string", "format": "at-uri" },
          "status":        { "type": "string", "knownValues": ["running", "completed", "failed", "timed-out"] },
          "agentVersion":  { "type": "string" },
          "durationMs":    { "type": "integer" },
          "claudeTokensIn": { "type": "integer" },
          "claudeTokensOut": { "type": "integer" },
          "scansRun":      { "type": "array", "items": { "type": "string" } },
          "recordsWritten": { "type": "integer" },
          "errorMessage":  { "type": "string", "maxLength": 2000 },
          "startedAt":     { "type": "string", "format": "datetime" },
          "completedAt":   { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### `governance.audit.waiver`

Approved exception to a control with expiry and justification.

```json
{
  "id": "sh.tangled.governance.audit.waiver",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["control", "repo", "reason", "grantedBy", "expiresAt", "createdAt"],
        "properties": {
          "control":    { "type": "string", "format": "at-uri" },
          "repo":       { "type": "string", "format": "at-uri" },
          "pullRequest": { "type": "string", "format": "at-uri", "description": "If waiver is PR-specific" },
          "reason":     { "type": "string", "maxLength": 2000 },
          "grantedBy":  { "type": "string", "format": "did" },
          "approvedBy": { "type": "string", "format": "did", "description": "Second approver if required" },
          "expiresAt":  { "type": "string", "format": "datetime" },
          "status":     { "type": "string", "knownValues": ["active", "expired", "revoked"] },
          "createdAt":  { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

---

## Record Count Summary

| Domain | Records | Count |
|---|---|---|
| Organization | organization, membership, team, role | 4 |
| Compliance | repoProfile, codeOwner, incident, slaTracker, prAssessment, controlEvaluation, requiredApproval, mergeGate, impactAssessment, propagation | 10 |
| Policy | policyPack, control, repoBinding, slaRule | 4 |
| Graph | repoDependency, serviceDependency, codeDependency | 3 |
| Audit | evidence, agentRun, waiver | 3 |
| **Total** | | **24 records** |
