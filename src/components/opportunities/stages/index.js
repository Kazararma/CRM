import ProspectingStage from './ProspectingStage';
import QualificationStage from './QualificationStage';
import NeedsAnalysisStage from './NeedsAnalysisStage';
import ValuePropositionStage from './ValuePropositionStage';
import DecisionMakersStage from './DecisionMakersStage';
import PerceptionAnalysisStage from './PerceptionAnalysisStage';
import ProposalStage from './ProposalStage';
import NegotiationReviewStage from './NegotiationReviewStage';
import ClosedWonStage from './ClosedWonStage';
import ClosedLostStage from './ClosedLostStage';

export const STAGE_COMPONENTS = {
  prospecting:         ProspectingStage,
  qualification:       QualificationStage,
  needs_analysis:      NeedsAnalysisStage,
  value_proposition:   ValuePropositionStage,
  decision_makers:     DecisionMakersStage,
  perception_analysis: PerceptionAnalysisStage,
  proposal:            ProposalStage,
  negotiation_review:  NegotiationReviewStage,
  closed_won:          ClosedWonStage,
  closed_lost:         ClosedLostStage,
};
