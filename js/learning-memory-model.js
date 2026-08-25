/*
 * Unified learning-memory data contract.
 * This file is intentionally framework-free so the existing HTML pages can
 * reuse it without changing the current front-end architecture.
 */
(function (root) {
  'use strict';

  var MODEL_VERSION = 1;
  var EVENT_TYPES = [
    'CHAT_QUESTION', 'CHAT_EXPLANATION_RECEIVED', 'USER_RESTATEMENT',
    'USER_CONFUSION', 'MISCONCEPTION_DETECTED', 'MISCONCEPTION_CORRECTED',
    'DIAGRAM_GENERATED', 'DIAGRAM_EDITED', 'FORCE_ADDED', 'FORCE_REMOVED',
    'FORCE_DIRECTION_CHANGED', 'ANIMATION_PREDICTION', 'ANIMATION_VIEWED',
    'PRACTICE_SUBMITTED', 'HINT_USED', 'NOTE_CONFIRMED', 'DIAGNOSIS_REJECTED'
  ];
  var ABILITY_TYPES = [
    'concept_understanding', 'structure_identification',
    'constraint_identification', 'force_analysis', 'method_selection',
    'equation_building', 'calculation', 'result_checking', 'transfer_application'
  ];
  var CONCEPT_TYPES = [
    'CONCEPT', 'FORMULA', 'PRINCIPLE', 'PROBLEM_TYPE', 'MECHANICAL_MODEL',
    'DIAGRAM', 'FREE_BODY_DIAGRAM', 'SOLUTION_STEP', 'MISCONCEPTION',
    'USER_QUESTION', 'USER_THOUGHT', 'LEARNING_NOTE', 'PRACTICE_RECORD'
  ];

  function createState(userId) {
    return {
      schema_version: MODEL_VERSION,
      user_id: String(userId || ''),
      conversations: [], messages: [], learning_events: [],
      concepts: [], concept_relations: [], user_thoughts: [],
      misconceptions: [], user_concept_states: [], learning_notes: [],
      weaknesses: [], updated_at: null
    };
  }

  function createId(prefix) {
    var random = Math.random().toString(36).slice(2, 10);
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + random;
  }

  function now() { return new Date().toISOString(); }

  function validEventType(type) { return EVENT_TYPES.indexOf(type) >= 0; }
  function validAbilityType(type) { return ABILITY_TYPES.indexOf(type) >= 0; }
  function validConceptType(type) { return CONCEPT_TYPES.indexOf(type) >= 0; }

  root.LearningMemoryModel = {
    MODEL_VERSION: MODEL_VERSION,
    EVENT_TYPES: EVENT_TYPES,
    ABILITY_TYPES: ABILITY_TYPES,
    CONCEPT_TYPES: CONCEPT_TYPES,
    createState: createState,
    createId: createId,
    now: now,
    validEventType: validEventType,
    validAbilityType: validAbilityType,
    validConceptType: validConceptType
  };
})(typeof window !== 'undefined' ? window : this);
