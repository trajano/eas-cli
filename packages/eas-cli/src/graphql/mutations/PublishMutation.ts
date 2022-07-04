import { gql } from 'graphql-tag';

import { graphqlClient, withErrorHandlingAsync } from '../client.js';
import {
  CodeSigningInfoInput,
  PublishUpdateGroupInput,
  SetCodeSigningInfoMutation,
  UpdatePublishMutation,
} from '../generated.js';

export const PublishMutation = {
  async getUploadURLsAsync(contentTypes: string[]): Promise<{ specifications: string[] }> {
    const data = await withErrorHandlingAsync(
      graphqlClient
        .mutation<
          { asset: { getSignedAssetUploadSpecifications: { specifications: string[] } } },
          { contentTypes: string[] }
        >(
          gql`
            mutation GetSignedUploadMutation($contentTypes: [String!]!) {
              asset {
                getSignedAssetUploadSpecifications(assetContentTypes: $contentTypes) {
                  specifications
                }
              }
            }
          `,
          {
            contentTypes,
          }
        )
        .toPromise()
    );
    return data.asset.getSignedAssetUploadSpecifications;
  },

  async publishUpdateGroupAsync(
    publishUpdateGroupsInput: PublishUpdateGroupInput[]
  ): Promise<UpdatePublishMutation['updateBranch']['publishUpdateGroups']> {
    const data = await withErrorHandlingAsync(
      graphqlClient
        .mutation<UpdatePublishMutation>(
          gql`
            mutation UpdatePublishMutation($publishUpdateGroupsInput: [PublishUpdateGroupInput!]!) {
              updateBranch {
                publishUpdateGroups(publishUpdateGroupsInput: $publishUpdateGroupsInput) {
                  id
                  group
                  runtimeVersion
                  platform
                  manifestPermalink
                }
              }
            }
          `,
          { publishUpdateGroupsInput }
        )
        .toPromise()
    );
    return data.updateBranch.publishUpdateGroups;
  },

  async setCodeSigningInfoAsync(
    updateId: string,
    codeSigningInfo: CodeSigningInfoInput
  ): Promise<SetCodeSigningInfoMutation['update']['setCodeSigningInfo']> {
    const data = await withErrorHandlingAsync(
      graphqlClient
        .mutation<SetCodeSigningInfoMutation>(
          gql`
            mutation SetCodeSigningInfoMutation(
              $updateId: ID!
              $codeSigningInfo: CodeSigningInfoInput!
            ) {
              update {
                setCodeSigningInfo(updateId: $updateId, codeSigningInfo: $codeSigningInfo) {
                  id
                  group
                  awaitingCodeSigningInfo
                  codeSigningInfo {
                    keyid
                    alg
                    sig
                  }
                }
              }
            }
          `,
          { updateId, codeSigningInfo }
        )
        .toPromise()
    );
    return data.update.setCodeSigningInfo;
  },
};
