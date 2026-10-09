// Who sees what in SunProof. Each party sees only what it needs.

// The household can read everything about its own home.
permit (principal is Household, action == Action::"read", resource)
when { resource.home == principal.home };

// The household must approve every message before it is sent to the installer.
permit (principal is Household, action == Action::"send_issue", resource)
when { resource.home == principal.home && context.approved == true };

// The installer (holding the link for one issue) sees generation data, the evidence and the issue status.
permit (principal is Installer, action == Action::"read", resource)
when {
  resource.issue == principal.issue &&
  ["generation", "evidence", "issue"].contains(resource.kind)
};

// The installer can respond to that one issue.
permit (principal is Installer, action == Action::"respond", resource)
when { resource.issue == principal.issue && resource.kind == "issue" };

// The installer never sees the bill or the household's contact details.
forbid (principal is Installer, action, resource)
when { ["bill", "household_contact"].contains(resource.kind) };

// The installer app (one fixed demo installer for now) sees only the jobs and the record that belong to that installer:
// generation data, evidence, issue status and its own record.
permit (principal is Pro, action == Action::"read", resource)
when {
  resource.installer == principal.pro &&
  ["generation", "evidence", "issue", "record"].contains(resource.kind)
};

// ...and can reply to those jobs and mark a visit done.
permit (principal is Pro, action == Action::"respond", resource)
when { resource.installer == principal.pro && resource.kind == "issue" };

// The installer app never sees the bill or the household's contact details either.
forbid (principal is Pro, action, resource)
when { ["bill", "household_contact"].contains(resource.kind) };
