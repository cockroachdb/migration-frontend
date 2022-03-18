import Moment from "react-moment";

import type { Statement } from "../importsSlice";

interface StatementsSummaryProps {
  statements: Statement[];
}

const estimatedEffort: Record<string, { issue: string; estimate: number; }> = {
  '17511': {
    issue: 'stored functions/procedures',
    estimate: 1000 * 60 * 60 * 24 * 7,
  },
  '31632': {
    issue: 'deferrable FKs',
    estimate: 1000 * 60 * 60 * 24 * 7,
  },
  '74777': {
    issue: 'pg extensions',
    estimate: 1000 * 60 * 60 * 24 * 7,
  },
  '74780': {
    issue: 'grant privilege on sequences',
    estimate: 1000 * 60,
  },
  '28296': {
    issue: 'trigger',
    estimate:  1000 * 60 * 60 * 24 * 7,
  }
};

export const StatementsSummary: React.FC<StatementsSummaryProps> = (props) => {
  var numDanger = 0;
  var numInfo = 0;

  const unimplementedIssueCount = new Map<string, number>();
  var numNoIssueUnimplemented = 0;
  var numMissingUser = 0;
  const re = /issue-v\/([0-9]*)/i;

  props.statements.forEach((statement) => {
    if (statement.deleted && statement.issues == null) {
      return;
    }

    statement.issues.forEach((issue) => {
      if (issue.level === "info") {
        numInfo++;
      } else {
        numDanger++;
        if (issue.type === "unimplemented") {
            const match = issue.text.match(re);
            if (match != null) {
              const issue = match[1];
              const curr = unimplementedIssueCount.get(issue);
              unimplementedIssueCount.set(issue, curr != null ? curr + 1: 1);
            } else {
              numNoIssueUnimplemented++;
            }
        } else if (issue.type === "missing_user") {
            numMissingUser++;
        }
      }
    });
  });

  const unimplementedIssueCountArr = Array.from(unimplementedIssueCount);
  unimplementedIssueCountArr.sort();

  var totalTime = 0;
  var totalUncatFixes = numDanger - numNoIssueUnimplemented - numMissingUser;
  const estimatedTimeList = (<ul>
    {unimplementedIssueCountArr.map(([issue, count], idx) => {
      const estimate = estimatedEffort[issue];
      if (estimate != null) {
        totalTime += estimate.estimate * count;
      }
      totalUncatFixes -= count;
      return (<li key={idx}>
        <a href={`https://go.crdb.dev/issue-v/${issue}/dev`} target="_blank" rel="noreferrer">Issue #{issue}</a> encountered {count} times
        {estimate != null ? <>
          . Feature '{estimate.issue}' would take approx&nbsp;<Moment date={new Date(Date.now() - estimate.estimate*count)} fromNow ago/>&nbsp;to migrate.
        </>: ''}
      </li>);
    })}
    {numNoIssueUnimplemented > 0 ? <li>{numNoIssueUnimplemented} uncategorised unimplemented errors.</li>: ''}
    {numMissingUser > 0 ? <li>{numMissingUser} statements with missing user/role in database.</li> : ''}
    {totalUncatFixes > 0 ? <li>{totalUncatFixes} uncategorised items.</li>: ''}
  </ul>)

  return (
    <ul>
      <li>{props.statements.length} statements found.</li>
      <li style={numDanger > 0 ? {color: 'red'}: {}}>{numDanger} fixes required.
        {totalTime > 0 ? <>
          &nbsp;Estimated fix time: <Moment date={new Date(Date.now() - totalTime)} fromNow ago/>.
        </>: ''}</li>
      {estimatedTimeList}
      <li style={numInfo > 0 ? {color: 'blue'} : {}}>{numInfo} optional audits.</li>
    </ul>
  )
}

